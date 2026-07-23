/**
 * Push notification utility — calls the `send-push` Edge Function
 * to deliver Expo push notifications to one or more users.
 *
 * The Edge Function uses service-role to query `push_tokens` and
 * sends via Expo Push API. This client function is fire-and-forget:
 * we don't block the UI on push delivery.
 */
import { supabase } from './supabase';

/**
 * Send a push notification to one or more users.
 * Fails silently — push is best-effort, never blocks the UI.
 */
export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
): Promise<void> {
  if (userIds.length === 0) return;

  const { error } = await supabase.functions.invoke('send-push', {
    body: { userIds, title, body },
  });

  if (error) {
    console.warn('[push] send-push failed:', error.message);
  }
}
