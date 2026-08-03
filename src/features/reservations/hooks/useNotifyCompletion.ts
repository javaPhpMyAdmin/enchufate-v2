/**
 * useNotifyCompletion — detects the `completada` transition on a
 * reservation and fires a review-prompt push notification to the
 * renter. Fire-and-forget: errors are swallowed (push is best-effort).
 *
 * **Why a dedicated hook?**
 * The `completada` status is set by a DB trigger (`end_at < now()`),
 * not by a client mutation. There is no `onSuccess` callback to
 * attach to. This hook uses a ref to track the previous status and
 * fires exactly once — on the transition TO `completada`.
 *
 * **Guard**: gated by `isFeatureEnabled('CHARGER_REVIEWS')`.
 *
 * **Notification**:
 *   title: "Reserva completada"
 *   body:  "¿Cómo fue tu carga en {charger_title}? Dejanos tu reseña"
 *
 * Uses the existing `send-push` Edge Function via `sendPushNotification`.
 */
import { useEffect, useRef } from 'react';

import { isFeatureEnabled } from '@/lib/features';
import { sendPushNotification } from '@/lib/push';

import type { Reservation } from '../types';

/**
 * Watch a reservation for the `completada` transition and send a
 * review-prompt push to the renter. Call once per reservation
 * detail screen mount.
 *
 * @param reservation — the current reservation data from `useReservation`.
 */
export function useNotifyCompletion(reservation: Reservation | undefined): void {
  // Track the previous status across renders. Initialized to
  // `undefined` so the first render is treated as "no prior status"
  // (avoids firing on mount when the reservation was already
  // `completada` before the component existed).
  const prevStatusRef = useRef<string | undefined>(undefined);
  // Ensures we fire at most once per mount.
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!reservation) return;
    if (!isFeatureEnabled('CHARGER_REVIEWS')) return;
    if (notifiedRef.current) return;

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = reservation.status;

    // Detect the transition TO `completada`:
    // 1. We had a previous status that was NOT `completada`
    //    AND the current status IS `completada` (real transition).
    // 2. OR this is the first render (prevStatus === undefined)
    //    and the status is already `completada` (edge case: user
    //    opens the detail screen after the trigger already fired).
    const isTransition =
      prevStatus !== undefined &&
      prevStatus !== 'completada' &&
      reservation.status === 'completada';
    const isAlreadyCompleted =
      prevStatus === undefined && reservation.status === 'completada';

    if (!isTransition && !isAlreadyCompleted) return;

    notifiedRef.current = true;

    const chargerTitle = reservation.charger_title || 'tu cargador';

    // Fire-and-forget — push is best-effort, never blocks the UI.
    void sendPushNotification(
      [reservation.renter_id],
      'Reserva completada',
      `¿Cómo fue tu carga en ${chargerTitle}? Dejanos tu reseña`,
      undefined,
      { type: 'reservation', reservationId: reservation.id },
    );
  }, [reservation]);
}
