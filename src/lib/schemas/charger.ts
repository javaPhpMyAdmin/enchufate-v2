/**
 * Zod schemas — `charger`.
 *
 * The `chargerSchema` is the input contract for any data that
 * enters the chargers feature boundary (form submissions, API
 * responses parsed from JSON, mock fixtures). It mirrors the
 * column constraints in
 * `supabase/migrations/20260718000001_init_chargers.sql`:
 *
 *   - `title` 1–80 chars (matches the `chargers.title` CHECK)
 *   - `description` ≤500 chars (matches the `chargers.description` CHECK)
 *   - `power_kw` 3.7–350 (matches the `chargers.power_kw` CHECK)
 *   - `price_per_hour_usd` > 0 (matches the `chargers.price_per_hour_usd` CHECK)
 *   - `photos` ≤5 entries (matches the `chargers.photos` CHECK)
 *   - `rules` ≤300 chars or null (matches the `chargers.rules` CHECK)
 *   - `schedule` jsonb with the 7 day keys (matches the `chargers.schedule` shape)
 *
 * The schema is consumed by:
 *   - `useCharger` to validate the mock on read (Phase 6 PR-A
 *     commit 3 onward; see the small follow-up edit in
 *     `hooks/useCharger.ts`)
 *   - The publish wizard step forms (Phase 6 PR-B+; each step
 *     calls `<step>Schema.parse(formData)` before mutating the
 *     publish store)
 *
 * Per `design.md §4.6`, schemas are used **only at the client data
 * layer boundary**, not in the database. The database enforces the
 * same constraints with CHECK constraints + RLS; the client schema
 * exists to surface a typed `AppError` BEFORE the round-trip when
 * the user is editing a form.
 */
import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Enum value tuples (reused as the runtime + compile-time enum)      */
/* ------------------------------------------------------------------ */

const CONNECTOR_VALUES = ['tipo_1', 'tipo_2', 'ccs', 'chademo', 'tesla'] as const;
const STATUS_VALUES = ['active', 'paused'] as const;
const MIN_RESERVATION_VALUES = [30, 60, 120, 240, 480] as const;

/** 24h "HH:MM" — validated by the regex below. */
const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ------------------------------------------------------------------ */
/* Sub-schemas                                                          */
/* ------------------------------------------------------------------ */

/** A single time window inside a day's availability schedule. */
export const dayWindowSchema = z.object({
  from: z.string().regex(HHMM_REGEX, 'Formato esperado: HH:MM (24h)'),
  to: z.string().regex(HHMM_REGEX, 'Formato esperado: HH:MM (24h)'),
});

/** 7-day availability: each key is a day-of-week, value is an array of windows. */
export const scheduleSchema = z.object({
  mon: z.array(dayWindowSchema),
  tue: z.array(dayWindowSchema),
  wed: z.array(dayWindowSchema),
  thu: z.array(dayWindowSchema),
  fri: z.array(dayWindowSchema),
  sat: z.array(dayWindowSchema),
  sun: z.array(dayWindowSchema),
});

/* ------------------------------------------------------------------ */
/* Main schema                                                          */
/* ------------------------------------------------------------------ */

export const chargerSchema = z.object({
  id: z.string().min(1),
  owner_id: z.string().min(1),
  title: z
    .string()
    .min(1, 'El título es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  description: z
    .string()
    .max(500, 'Máximo 500 caracteres')
    .default(''),
  address: z.string().min(1, 'La dirección es obligatoria'),
  lat: z.number(),
  lng: z.number(),
  connector_type: z.enum(CONNECTOR_VALUES),
  power_kw: z
    .number()
    .min(3.7, 'Mínimo 3.7 kW')
    .max(350, 'Máximo 350 kW'),
  price_per_hour_usd: z
    .number()
    .positive('El precio tiene que ser mayor a 0'),
  min_reservation_minutes: z.union([
    z.literal(30),
    z.literal(60),
    z.literal(120),
    z.literal(240),
    z.literal(480),
  ]),
  photos: z
    .array(z.string())
    .max(5, 'Máximo 5 fotos'),
  rules: z
    .string()
    .max(300, 'Máximo 300 caracteres')
    .nullable(),
  schedule: scheduleSchema,
  status: z.enum(STATUS_VALUES),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Inferred types                                                       */
/* ------------------------------------------------------------------ */

export type ChargerInput = z.infer<typeof chargerSchema>;
export type DayWindowInput = z.infer<typeof dayWindowSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
