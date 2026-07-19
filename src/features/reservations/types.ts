/**
 * Reservations — canonical TypeScript shapes.
 *
 * The shapes mirror the `public.reservations` table that will be
 * created in Phase 7 of `mvp-bootstrap`. The type is denormalized
 * with the charger + renter + host info (names, addresses, lat/lng)
 * so the list and detail screens don't have to do a second round-
 * trip to render each card. Phase 7's real query will use a
 * Supabase join with `chargers` and `profiles`; the hook signature
 * stays identical.
 *
 * The `timeBlock()` helper renders the spec-required "time block"
 * field: a `start_at – end_at` range when both are set, else the
 * free-text `horario_a_coordinar` string. The list + detail cards
 * use this helper so the display rule is centralised.
 */
import { formatDateTime } from '@/lib/format';

export type ReservationStatus = 'solicitada' | 'confirmada' | 'cancelada' | 'completada';

export type ReservationRole = 'renter' | 'host';

export interface Reservation {
  id: string;
  charger_id: string;
  /** Denormalized from `public.chargers.title`. */
  charger_title: string;
  /** Denormalized from `public.chargers.address`. */
  charger_address: string;
  /** Denormalized from `public.chargers.lat` for the "Cómo llegar" link. */
  charger_lat: number;
  /** Denormalized from `public.chargers.lng` for the "Cómo llegar" link. */
  charger_lng: number;
  /** Denormalized from `public.chargers.power_kw`. */
  charger_power_kw: number;
  /** Denormalized from `public.chargers.connector_type`. */
  charger_connector_type: string;
  renter_id: string;
  renter_name: string;
  renter_avatar_url: string | null;
  host_id: string;
  host_name: string;
  host_avatar_url: string | null;
  /** ISO 8601 — `null` when the time is `horario_a_coordinar`. */
  start_at: string | null;
  /** ISO 8601 — `null` when the time is `horario_a_coordinar`. */
  end_at: string | null;
  /** Free-text fallback per the Q5 default. */
  horario_a_coordinar: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
  /**
   * The conversation id paired with this reservation. Phase 7
   * derives it from `(charger_id, renter_id)`; the mock data
   * hardcodes it for the "Chatear" CTA on the detail screen.
   */
  conversation_id: string;
}

export interface ReservationParty {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Pick the "other party" for a reservation from the perspective
 * of `currentUserId`. Renter view → host is the other party;
 * host view → renter is the other party. Falls back to host when
 * `currentUserId` is missing (defensive).
 */
export function otherParty(
  reservation: Reservation,
  currentUserId: string | null | undefined,
): ReservationParty {
  if (currentUserId && reservation.host_id === currentUserId) {
    return {
      id: reservation.renter_id,
      name: reservation.renter_name,
      avatarUrl: reservation.renter_avatar_url,
    };
  }
  return {
    id: reservation.host_id,
    name: reservation.host_name,
    avatarUrl: reservation.host_avatar_url,
  };
}

/** Whether the cancel CTA should render for a given status. */
export function isCancellable(status: ReservationStatus): boolean {
  return status === 'solicitada' || status === 'confirmada';
}

/**
 * Build the time-block string the cards display. Structured
 * `start_at` / `end_at` wins; falls back to the free-text
 * `horario_a_coordinar`; falls back again to a generic copy.
 */
export function timeBlock(reservation: Reservation): string {
  if (reservation.start_at && reservation.end_at) {
    const start = formatDateTime(reservation.start_at);
    const endTime = new Intl.DateTimeFormat('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(reservation.end_at));
    return `${start} – ${endTime}`;
  }
  return reservation.horario_a_coordinar ?? 'Horario a coordinar';
}
