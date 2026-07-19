/**
 * Reservation state machine — pure helper.
 *
 * Encodes the 6 valid status transitions from `design.md §9.1` and
 * the `reservations` spec. The same helper is used:
 *   - client-side by `useConfirmReservation` and `useCancelReservation`
 *     to early-return on invalid transitions BEFORE the network round
 *     trip (better UX than waiting for a 4xx RLS response);
 *   - implicitly by the `isCancellable` helper which decides whether
 *     to render the "Cancelar reserva" CTA on the detail screen.
 *
 * Status values map 1:1 to the SQL `reservation_status` enum
 * (`solicitada | confirmada | cancelada | completada`). The two
 * terminal states (`cancelada`, `completada`) have no outgoing
 * transitions; the `completada` transition is server-driven by the
 * `handle_reservation_completed` trigger (no user action).
 *
 * Pure function: no I/O, no React, no Supabase. Safe to import from
 * both the client mutation hook and any future server-side
 * validation layer.
 */

/**
 * Status enum mirrors the SQL `reservation_status` from
 * `supabase/migrations/20260719000001_reservations.sql`:
 *   'solicitada' | 'confirmada' | 'cancelada' | 'completada'
 *
 * `completada` is server-driven (the
 * `handle_reservation_completed` trigger auto-flips past `end_at`)
 * and never a user-initiated action, so it has no outgoing
 * transitions below.
 */
export type ReservationStatus =
  | 'solicitada'
  | 'confirmada'
  | 'cancelada'
  | 'completada';

export type ReservationActor = 'renter' | 'host' | 'system';

export type ReservationAction = 'confirm' | 'cancel' | 'complete';

interface Transition {
  from: ReservationStatus;
  to: ReservationStatus;
  by: ReservationActor;
}

/**
 * All valid status transitions, per `design.md §9.1`. Order is
 * stable so the linear-scan `canTransition` is deterministic.
 *
 * The `completada` transition is system-driven (DB trigger flips
 * past `end_at`); it appears here so `canTransition` answers
 * truthfully when called with `by: 'system'`, but no hook in the
 * app ever calls `nextStatus` with action `'complete'` — the
 * trigger handles it.
 */
export const TRANSITIONS: readonly Transition[] = [
  { from: 'solicitada', to: 'confirmada', by: 'host' },
  { from: 'solicitada', to: 'cancelada', by: 'renter' },
  { from: 'solicitada', to: 'cancelada', by: 'host' },
  { from: 'confirmada', to: 'cancelada', by: 'renter' },
  { from: 'confirmada', to: 'cancelada', by: 'host' },
  { from: 'confirmada', to: 'completada', by: 'system' },
];

/**
 * True when the transition is valid. Used as a guard by the
 * mutation hooks: an invalid transition throws a typed `AppError`
 * with `code: 'invalid_transition'` so the UI can show a friendly
 * voseo error ("Esta reserva ya no se puede cancelar") instead of
 * a generic 4xx toast.
 */
export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus,
  by: ReservationActor,
): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.by === by);
}

/**
 * Resolve the next status for a user-initiated action. Returns
 * `null` when the action is not valid in the current state. This
 * is the inverse of `canTransition` — it answers "what status
 * should I write?" rather than "is this transition allowed?".
 */
export function nextStatus(
  from: ReservationStatus,
  action: ReservationAction,
  by: ReservationActor,
): ReservationStatus | null {
  if (action === 'confirm') {
    return canTransition(from, 'confirmada', by) ? 'confirmada' : null;
  }
  if (action === 'cancel') {
    return canTransition(from, 'cancelada', by) ? 'cancelada' : null;
  }
  if (action === 'complete') {
    // Server-driven (DB trigger). We return the next status when
    // called with `by: 'system'` for completeness, but no client
    // mutation hook ever calls this — the trigger owns the
    // transition end-to-end.
    return canTransition(from, 'completada', by) ? 'completada' : null;
  }
  return null;
}

/**
 * True when the cancel CTA should render for the given status.
 * Mirrors the existing `isCancellable` in `types.ts`; this version
 * is the single source of truth for the state machine and is
 * re-exported through the reservation feature. The detail screen
 * keeps using `isCancellable` from `types.ts` (which delegates
 * here in a follow-up commit) so the screen file does not need to
 * change.
 */
export function isCancellable(status: ReservationStatus): boolean {
  return status === 'solicitada' || status === 'confirmada';
}
