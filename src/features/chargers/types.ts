/**
 * Charger — the canonical TypeScript shape for a charger record.
 *
 * Mirrors the `public.chargers` table created in
 * `supabase/migrations/20260718000001_init_chargers.sql` (Phase 4
 * scope). The Database type in `src/lib/database.types.ts` will
 * regenerate this shape after the first migration runs, but the
 * mock data + Phase 4 useChargers hook need a concrete interface
 * to type against today.
 *
 * Money is stored in USD (`price_per_hour_usd`) per the design; the
 * UI multiplies by the live exchange rate and renders in UYU when
 * the user's locale prefers it. Mock data uses realistic Uruguay
 * market rates (~$0.50-$1.50/hr).
 *
 * The `schedule` jsonb shape is encoded as a `Record<DayKey, DayWindow[]>`.
 * An empty array for a day means "no disponible"; a missing day key
 * means "always available (24/7)" by convention.
 */

export type ConnectorType = 'tipo_1' | 'tipo_2' | 'ccs' | 'chademo' | 'tesla';
export type ChargerStatus = 'active' | 'paused';
export type MinReservationMinutes = 30 | 60 | 120 | 240 | 480;

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayWindow {
  /** 24h "HH:MM" */
  from: string;
  /** 24h "HH:MM" */
  to: string;
}

export type ChargerSchedule = Record<DayKey, DayWindow[]>;

export interface Charger {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  connector_type: ConnectorType;
  power_kw: number;
  price_per_hour_usd: number;
  min_reservation_minutes: MinReservationMinutes;
  photos: string[];
  rules: string | null;
  schedule: ChargerSchedule;
  status: ChargerStatus;
  created_at: string;
  updated_at: string;
}

/** Display-only convenience: the human-readable connector label. */
export const CONNECTOR_LABEL: Record<ConnectorType, string> = {
  tipo_1: 'Tipo 1',
  tipo_2: 'Tipo 2',
  ccs: 'CCS',
  chademo: 'CHAdeMO',
  tesla: 'Tesla',
};
