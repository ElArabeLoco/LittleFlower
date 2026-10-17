/**
 * SupabaseConnector — the bridge between Supabase and PowerSync.
 *
 * PowerSync requires a "connector" object with two responsibilities:
 *   1. fetchCredentials() — provides a JWT token so PowerSync can authenticate
 *      against the PowerSync Cloud service (which then reads from Supabase).
 *   2. uploadData() — flushes local SQLite writes to Supabase Postgres after
 *      the user is back online.
 *
 * Architecture:
 *   Browser SQLite (PowerSync WASM)
 *     ↕  sync (PowerSync Cloud reads Supabase via logical replication)
 *   PowerSync Cloud
 *     ↕  uploadData (this connector writes back to Supabase REST)
 *   Supabase Postgres (source of truth)
 *
 * All writes go through uploadData → Supabase REST API (upsert/delete).
 * PowerSync handles the offline queue and retry logic automatically.
 *
 * Conflict resolution: Last-Write-Wins (LWW) by Supabase updated_at.
 * For a 2-person cooperative household this is acceptable for MVP.
 */

import { createClient, SupabaseClient, type PostgrestError } from '@supabase/supabase-js';
import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  CrudEntry,
  PowerSyncCredentials,
} from '@powersync/web';
import { describeCrudEntry } from './sync/describeRecord';
import { SyncUploadError, classifySupabaseError, classifySyncError } from './sync/syncErrors';
import { syncActivity } from './sync/syncActivityStore';

// ---------------------------------------------------------------------------
// Supabase client (singleton, shared with auth adapter)
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------------------
// SupabaseConnector
// ---------------------------------------------------------------------------

export class SupabaseConnector implements PowerSyncBackendConnector {
  /**
   * Called by PowerSync whenever it needs fresh credentials to connect to the
   * PowerSync Cloud sync service. We provide the Supabase JWT here — PowerSync
   * Cloud verifies it against the Supabase JWT secret configured in the
   * PowerSync dashboard.
   */
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      throw new Error('No active Supabase session. User must be logged in before PowerSync connects.');
    }

    return {
      endpoint: import.meta.env.VITE_POWERSYNC_URL as string,
      token: data.session.access_token,
    };
  }

  /**
   * Called by PowerSync when there are local writes to flush to Supabase.
   * PowerSync passes a CrudTransaction with a batch of CRUD entries.
   *
   * Strategy:
   *  - INSERT / UPDATE → upsert to Supabase (idempotent)
   *  - DELETE → hard delete from Supabase
   *
   * Note: expenses are append-only in our domain. The "delete" case for
   * expenses is handled at the domain level as a soft-delete (deleted_at field)
   * or a reversal record (negative amount). PowerSync-level DELETEs should
   * never occur for the expenses table in normal operation.
   *
   * Activity log: every attempt is recorded in the sync activity store — an
   * upload once the transaction completes, or a classified failure (folded
   * across retries) before rethrowing. The store is the only place the UI can
   * read the classification from: errors reach the sync worker without their
   * custom properties.
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    // Related budget/income/debt names come from the label cache (default lookup).
    const changes = transaction.crud.map((entry) => describeCrudEntry(entry));

    try {
      for (const entry of transaction.crud) {
        await this._applyEntry(entry);
      }
      await transaction.complete();
    } catch (err) {
      // Do NOT call transaction.complete() on error — PowerSync will retry
      const info = err instanceof SyncUploadError ? err.info : classifySyncError(err, navigator.onLine);
      syncActivity.recordUploadFailure(changes, info);
      console.error(`[SupabaseConnector] uploadData failed (${info.kind}), will retry:`, err);
      throw err instanceof SyncUploadError ? err : new SyncUploadError(info, { cause: err });
    }

    // Outside the try: a logging problem must never look like an upload failure.
    syncActivity.recordUpload(changes);
  }

  // ---------------------------------------------------------------------------
  // Private — apply a single CRUD entry to Supabase
  // ---------------------------------------------------------------------------

  private async _applyEntry(entry: CrudEntry): Promise<void> {
    const table = entry.table;
    const id = entry.id;

    switch (entry.op) {
      case 'PUT': {
        // INSERT or UPDATE — use upsert (on_conflict=id)
        const payload = { id, ...entry.opData };
        const { error, status } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
        if (error) throw toUploadError(entry, error, status);
        break;
      }

      case 'PATCH': {
        // Partial update
        const { error, status } = await supabase.from(table).update(entry.opData ?? {}).eq('id', id);
        if (error) throw toUploadError(entry, error, status);
        break;
      }

      case 'DELETE': {
        const { error, status } = await supabase.from(table).delete().eq('id', id);
        if (error) throw toUploadError(entry, error, status);
        break;
      }

      default:
        console.warn(`[SupabaseConnector] Unknown op: ${(entry as CrudEntry).op}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Private — classified upload errors
// ---------------------------------------------------------------------------

/**
 * Classifies a failed Supabase write (offline / auth / rejected / server)
 * using the PostgREST code and the HTTP status (0 = the request never left).
 */
function toUploadError(entry: CrudEntry, error: PostgrestError, status: number): SyncUploadError {
  return new SyncUploadError(
    classifySupabaseError(error, { status, table: entry.table, op: entry.op, recordId: entry.id }),
  );
}
