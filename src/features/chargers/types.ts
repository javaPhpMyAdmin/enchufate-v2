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

export type ConnectorType = 'tipo_1' | 'tipo_2' | 'ccs' | 'chademo' | 'tesla' | 'gb_t';
export type ChargerStatus = 'active' | 'paused';
export type MinReservationMinutes = 30 | 60 | 120 | 240 | 480;
export type Currency = 'USD' | 'UYU' | 'ARS';

export type ChargerSource = 'enchufate' | 'ute' | 'ocm';

export interface ConnectorInfo {
  type: ConnectorType;
  power_kw: number;
  count: number;
  status?: 'available' | 'occupied' | 'out_of_service';
  has_cable?: boolean;
}

// ── Connector helpers ────────────────────────────────────────

/** AC vs DC classification. */
export function connectorCurrent(type: ConnectorType): 'AC' | 'DC' {
  return type === 'tipo_1' || type === 'tipo_2' ? 'AC' : 'DC';
}

/** Speed category based on power_kw. */
export function connectorSpeedLabel(power_kw: number): string {
  if (power_kw < 7) return 'Lenta';
  if (power_kw < 22) return 'Semi-rápida';
  if (power_kw < 50) return 'Rápida';
  return 'Ultra-rápida';
}

/**
 * MapCharger — normalized display type that normalizes both
 * Supabase Charger records and UTE API stations into one shape
 * the map renders.
 */
export interface MapCharger {
  id: string;
  source: ChargerSource;
  title: string;
  address: string;
  city?: string;
  department?: string;
  lat: number;
  lng: number;
  connectors: ConnectorInfo[];
  // P2P-only fields (undefined for UTE)
  price_per_hour_usd?: number;
  currency?: Currency;
  status?: ChargerStatus;
  owner_id?: string;
  // Populated when source='ute' for connector-list display
  station_status?: 'operational' | 'limited' | 'offline';
  /** Set when this P2P charger is in an active charging session.
   *  ISO 8601 timestamp populated by the DB trigger on en_curso
   *  transitions; null when idle or completed. */
  current_charging_since?: string;
}

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
  currency: Currency;
  min_reservation_minutes: MinReservationMinutes;
  photos: string[];
  rules: string | null;
  schedule: ChargerSchedule;
  status: ChargerStatus;
  avg_rating: number;
  review_count: number;
  current_charging_since: string | null;
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
  gb_t: 'GB/T',
};
