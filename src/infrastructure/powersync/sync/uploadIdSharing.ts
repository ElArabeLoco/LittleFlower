/**
 * Cross-tab upload id sharing.
 *
 * PowerSync runs uploadData in one tab only (the one whose connector the sync
 * worker uses), so only that tab knows which downloaded rows are echoes of
 * its own uploads. Each tab broadcasts the ids it uploads; the other tabs
 * remember them, so their download trackers skip those echoes as well (and
 * their copies of a failure resolve once the records finally upload).
 */

import type { SyncActivityStore } from './syncActivityStore';

export const SYNC_ACTIVITY_CHANNEL = 'lf-sync-activity';

/** The slice of BroadcastChannel the sharing needs (injected; faked in tests). */
export interface UploadIdChannel {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
}

export interface UploadIdSharingOptions {
  store: Pick<SyncActivityStore, 'onUpload' | 'rememberUploadedIds'>;
  /** null where BroadcastChannel is unavailable: sharing is then a no-op. */
  channel: UploadIdChannel | null;
}

interface UploadedIdsMessage {
  type: 'uploaded-ids';
  ids: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Starts sharing; returns a function that stops it and closes the channel. */
export function startUploadIdSharing({ store, channel }: UploadIdSharingOptions): () => void {
  if (!channel) return () => {};

  const stopBroadcasting = store.onUpload((ids) => {
    const message: UploadedIdsMessage = { type: 'uploaded-ids', ids };
    try {
      channel.postMessage(message);
    } catch (error) {
      // A closed or broken channel only costs the other tabs their echo hints.
      console.warn('[SyncActivity] Could not share uploaded ids with other tabs:', error);
    }
  });

  const onMessage = (event: MessageEvent) => {
    const ids = readUploadedIds(event.data);
    if (ids.length > 0) store.rememberUploadedIds(ids);
  };
  channel.addEventListener('message', onMessage);

  return () => {
    stopBroadcasting();
    channel.removeEventListener('message', onMessage);
    channel.close();
  };
}

/** Opens the app's sync activity channel, or null when it is not available. */
export function openUploadIdChannel(): UploadIdChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(SYNC_ACTIVITY_CHANNEL);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function readUploadedIds(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) return [];
  const { type, ids } = data as { type?: unknown; ids?: unknown };
  if (type !== 'uploaded-ids' || !Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string' && id !== '');
}
