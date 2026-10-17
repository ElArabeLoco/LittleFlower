/**
 * Manual sync retry ("Retry now").
 *
 * Restarts the sync stream with fresh credentials: the upload queue is
 * retried right away and a new download stream is opened, instead of
 * waiting for PowerSync's own retry delay. Without a Supabase session there
 * is nothing to sync with, so it does nothing (connecting would only fail
 * on credentials and log another error).
 */

import { db } from '../client';
import { supabase, SupabaseConnector } from '../SupabaseConnector';

export async function reconnectSync(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  await db.disconnect();
  await db.connect(new SupabaseConnector());
}
