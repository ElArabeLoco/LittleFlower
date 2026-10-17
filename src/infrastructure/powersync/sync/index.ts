/**
 * Sync activity model — public entry point.
 *
 * The application layer imports the sync model from here. SupabaseConnector
 * must keep importing the individual modules, never this barrel: this file
 * imports the db and (through reconnect) the connector, so a barrel import
 * from the connector would be an import cycle.
 */

import { db } from '../client';
import { AppSchema } from '../schema';
import { startConnectionTracking } from './connectionTracker';
import { startDownloadTracking } from './downloadTracker';
import { labelCache } from './labelCache';
import { syncActivity } from './syncActivityStore';
import { openUploadIdChannel, startUploadIdSharing } from './uploadIdSharing';

export * from './types';
export * from './syncErrors';
export * from './describeRecord';
export * from './labelCache';
export * from './syncActivityStore';
export * from './snapshotDiff';
export * from './downloadTracker';
export * from './connectionTracker';
export * from './uploadIdSharing';
export * from './reconnect';

/** Every synced table — the fixed allowlist the download tracker reads. */
export const TRACKED_TABLES: readonly string[] = AppSchema.tables.map((table) => table.name);

let stopTracking: (() => void) | null = null;

/**
 * Starts the connection, download and cross-tab trackers for the app's db,
 * activity store and label cache. Idempotent: while tracking runs, every call
 * returns the same stop function.
 */
export function startSyncActivityTracking(): () => void {
  if (stopTracking) return stopTracking;

  const stops = [
    startConnectionTracking({ db, store: syncActivity }),
    startDownloadTracking({ db, store: syncActivity, labelCache, tables: TRACKED_TABLES }),
    startUploadIdSharing({ store: syncActivity, channel: openUploadIdChannel() }),
  ];

  const stop = () => {
    if (stopTracking !== stop) return;
    stopTracking = null;
    for (const stopOne of stops) stopOne();
  };
  stopTracking = stop;
  return stop;
}
