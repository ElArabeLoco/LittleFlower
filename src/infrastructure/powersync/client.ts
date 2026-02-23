/**
 * PowerSync client singleton.
 *
 * PowerSyncDatabase wraps a local SQLite database (via WASM) and keeps it
 * in sync with Supabase Postgres through the PowerSync Cloud service.
 *
 * Usage:
 *   import { db } from '@/infrastructure/powersync/client';
 *
 *   // Query (one-shot)
 *   const rows = await db.getAll('SELECT * FROM expenses WHERE month = ?', [month]);
 *
 *   // Reactive query (re-renders on change) — use PowerSyncContext + hooks in UI
 *
 * The connector (SupabaseConnector) is initialized separately and connected
 * via db.connect(connector) after the user logs in. Before connect(), the db
 * works fully offline against the local SQLite cache.
 *
 * The `db` export is the single instance used throughout the app.
 * Never instantiate PowerSyncDatabase directly in feature code.
 */

import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    // The SQLite database name in the browser's Origin Private File System (OPFS)
    dbFilename: 'littleflower.db',
  },
});
