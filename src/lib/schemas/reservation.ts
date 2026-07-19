/**
 * Zod schemas — `reservation`.
 *
 * The `reservationSchema` encodes the hybrid time-storage rule
 * from `design.md §3.3` and the `reservations` spec: every
 * reservation has EITHER a structured `start_at` + `end_at` pair
 * OR a free-text `horario_a_coordinar` fallback — never both,
 * never neither. When both `start_at` and `end_at` are set,
 * `end_at` must be strictly after `start_at`.
 *
 * The schema is consumed by:
 *   - `useCreateReservation` mutation input (Phase 7) to validate
 *     the renter's date+time selection before posting.
 *   - The `ReservationRequestSheet` (Phase 7) to drive the
 *     "Lo antes posible" toggle's enabled state.
 *
 * The schema is permissive about the denormalized fields
 * (`charger_title`, `renter_name`, `conversation_id`) because
 * those are computed on the server during INSERT and returned in
 * the SELECT response; the client only needs to validate the
 * user-supplied subset (time, status, party ids).
 */
import { z } from 'zod';

const RESERVATION_STATUS_VALUES = [
  'solicitada',
  'confirmada',
  'cancelada',
  'completada',
] as const;

/** ISO 8601 timestamp — validated with a regex for portability
 *  across zod v3/v4 (`z.string().datetime()` was renamed in v4). */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

export const reservationSchema = z
  .object({
    id: z.string().min(1),
    charger_id: z.string().min(1),
    renter_id: z.string().min(1),
    start_at: z
      .string()
      .regex(ISO_8601_REGEX, 'Fecha inválida (esperado ISO 8601)')
      .nullable(),
    end_at: z
      .string()
      .regex(ISO_8601_REGEX, 'Fecha inválida (esperado ISO 8601)')
      .nullable(),
    horario_a_coordinar: z.string().min(1).nullable(),
    status: z.enum(RESERVATION_STATUS_VALUES),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
  })
  // Hybrid time-storage rule: either BOTH timestamps OR the
  // free-text fallback, never a mix. The `.refine` receives the
  // full parsed object so it can read both fields.
  .refine(
    (data) => {
      const hasTime = data.start_at !== null && data.end_at !== null;
      const hasText = data.horario_a_coordinar !== null;
      return (hasTime && !hasText) || (!hasTime && hasText);
    },
    {
      message:
        'La reserva debe tener horario (inicio + fin) o "horario a coordinar"',
      path: ['start_at'],
    },
  )
  // When both timestamps are set, end_at must be strictly after
  // start_at. The `path` is `end_at` so the form error attaches
  // to the end-time field.
  .refine(
    (data) => {
      if (data.start_at && data.end_at) {
        return new Date(data.end_at).getTime() > new Date(data.start_at).getTime();
      }
      return true;
    },
    {
      message: 'La hora de fin tiene que ser después de la hora de inicio',
      path: ['end_at'],
    },
  );

/** Input-only shape used by `useCreateReservation` — strips the
 *  server-managed ids + timestamps. */
export const reservationInputSchema = z
  .object({
    charger_id: z.string().min(1),
    renter_id: z.string().min(1),
    start_at: z
      .string()
      .regex(ISO_8601_REGEX, 'Fecha inválida (esperado ISO 8601)')
      .nullable(),
    end_at: z
      .string()
      .regex(ISO_8601_REGEX, 'Fecha inválida (esperado ISO 8601)')
      .nullable(),
    horario_a_coordinar: z.string().min(1).nullable(),
  })
  .refine(
    (data) => {
      const hasTime = data.start_at !== null && data.end_at !== null;
      const hasText = data.horario_a_coordinar !== null;
      return (hasTime && !hasText) || (!hasTime && hasText);
    },
    { message: 'Reservá un horario o escribí "a coordinar"' },
  )
  .refine(
    (data) => {
      if (data.start_at && data.end_at) {
        return new Date(data.end_at).getTime() > new Date(data.start_at).getTime();
      }
      return true;
    },
    { message: 'La hora de fin tiene que ser después de la hora de inicio' },
  );

export type ReservationInput = z.infer<typeof reservationSchema>;
export type ReservationCreateInput = z.infer<typeof reservationInputSchema>;
