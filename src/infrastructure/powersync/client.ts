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
// IDBBatchAtomicVFS — it causes RangeError: Maximum call stack size exceeded,
// tab crashes, and excessive CPU usage (device runs hot).
//
// OPFSCoopSyncVFS is the VFS recommended by PowerSync for Safari/iOS:
//   https://docs.powersync.com/client-sdk-references/js-web
//
// Chrome/Edge work fine with the default IDBBatchAtomicVFS and already have
// an existing DB there — switching VFS on them loses the local cache.
// So: use OPFSCoopSyncVFS only on Safari/iOS, default elsewhere.
const isSafariOrIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'));

const vfs = isSafariOrIOS
  ? WASQLiteVFS.OPFSCoopSyncVFS
  : WASQLiteVFS.IDBBatchAtomicVFS;

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: new WASQLiteOpenFactory({
    dbFilename: 'littleflower.db',
    vfs,
  }),
});
