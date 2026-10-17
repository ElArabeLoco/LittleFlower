/**
 * Manual sync retry ("Retry now").
 *
 * Restarts the sync stream with fresh credentials: the upload queue is
 * retried right away and a new download stream is opened, instead of
 * waiting for PowerSync's own retry delay.
 */

import { db } from '../client';
import { SupabaseConnector } from '../SupabaseConnector';

export async function reconnectSync(): Promise<void> {
  await db.disconnect();
  await db.connect(new SupabaseConnector());
}
