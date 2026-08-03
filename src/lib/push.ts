/**
 * Push notification utility — calls the `send-push` Edge Function
 * to deliver Expo push notifications to one or more users.
 *
 * The Edge Function uses service-role to query `push_tokens` and
 * sends via Expo Push API. This client function is fire-and-forget:
 * we don't block the UI on push delivery.
 */
import { supabase } from './supabase';

type NotificationType = 'reservations' | 'messages' | 'reviews' | 'promotions';

/**
 * Send a push notification to one or more users.
 * Fails silently — push is best-effort, never blocks the UI.
 *
 * @param notificationType - optional type for preference filtering.
 *   When provided, users who opted out of this type are skipped.
 * @param data - optional key/value payload (string values only —
 *   Expo/APNs require string values in the push `data` envelope).
 *   The client's notification-response listener reads this to
 *   navigate on tap (e.g. `{ type: 'reservation', reservationId }`).
 */
export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
  notificationType?: NotificationType,
  data?: Record<string, string>,
): Promise<void> {
  if (userIds.length === 0) return;

  const { error } = await supabase.functions.invoke('send-push', {
    body: { userIds, title, body, notificationType, data },
  });

  if (error) {
    console.warn('[push] send-push failed:', error.message);
  }
}
