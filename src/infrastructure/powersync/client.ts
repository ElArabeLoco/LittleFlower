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

import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web';
import { AppSchema } from './schema';

// Safari (desktop and iOS) has known stability issues with the default
// IDBBatchAtomicVFS — it causes stack overflow crashes and tab terminations,
// especially on low-memory devices like iPhones.
//
// OPFSCoopSyncVFS is the PowerSync-recommended VFS for Safari/iOS:
//   https://docs.powersync.com/client-sdk-references/js-web
//
// Multi-tab sync via SharedWorker is disabled on iOS Safari because
// SharedWorker is not reliably supported there. Disabling it prevents
// PowerSync from attempting to spawn a SharedWorker and failing silently,
// which can cause memory pressure and tab crashes.
const multiTabsEnabled = typeof SharedWorker !== 'undefined';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: new WASQLiteOpenFactory({
    dbFilename: 'littleflower.db',
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    flags: {
      enableMultiTabs: multiTabsEnabled,
    },
  }),
  flags: {
    enableMultiTabs: multiTabsEnabled,
  },
});
