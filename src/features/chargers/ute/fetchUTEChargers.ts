/**
 * UTE API client — fetches and normalizes UTE public charging stations
 * into MapCharger[].
 *
 * Endpoint: https://movilidad.ute.com.uy/api/v1/station/status/map
 * Auth: unauthenticated, but requires a `uniqueKeyUser: nginx` header.
 *
 * The API returns live station status (available/occupied/out_of_service)
 * with connector details. We normalize into MapCharger[] so the map
 * can render UTE alongside P2P chargers.
 */
import type { ConnectorInfo, ConnectorType, MapCharger } from '../types';

// ── Raw UTE API response types ─────────────────────────────

interface UTEConnector {
  /** e.g. "CCS2", "Tipo 2", "GB/T" */
  connectorType?: string;
  power?: number;
  /** e.g. "available", "occupied", "out_of_service" */
  status?: string;
}

interface UTEServiceStation {
  id?: string;
  stationName?: string;
  stationAddress?: string;
  city?: string;
  department?: string;
  latitude?: number | null;
  longitude?: number | null;
  connectors?: UTEConnector[];
  /** e.g. "operational", "limited", "offline" */
  stationStatus?: string;
}

type FTEResponse = UTEServiceStation[];

// ── Connector type mapping ──────────────────────────────────

const CONNECTOR_MAP: Record<string, ConnectorType> = {
  CCS2: 'ccs',
  CCS: 'ccs',
  'Tipo 2': 'tipo_2',
  'Tipo 1': 'tipo_1',
  'GB/T': 'gb_t',
  CHAdeMO: 'chademo',
  Tesla: 'tesla',
};

// ── Normalization ────────────────────────────────────────────

/**
 * Normalize a single UTE station into a MapCharger.
 * Returns null when lat/lng are missing or invalid.
 */
function normalizeUTESation(station: UTEServiceStation): MapCharger | null {
  const lat = station.latitude;
  const lng = station.longitude;

  // Exclude stations with null/invalid coordinates.
  if (lat == null || lng == null || lat === 0 || lng === 0) {
    console.warn('[UTE] Excluding station with null/zero coords:', station.stationName);
    return null;
  }

  const connectors: ConnectorInfo[] = (station.connectors ?? []).map((c) => {
    const rawType = c.connectorType ?? '';
    const type = CONNECTOR_MAP[rawType];

    if (type === undefined) {
      console.warn(`[UTE] Unknown connector type: "${rawType}" in station "${station.stationName}"`);
    }

    return {
      type: type ?? 'tipo_2',
      power_kw: c.power ?? 0,
      count: 1,
      status: c.status as ConnectorInfo['status'] | undefined,
    };
  });

  return {
    id: `ute-${station.id ?? 'unknown'}`,
    source: 'ute',
    title: station.stationName ?? 'Estación UTE',
    address: station.stationAddress ?? '',
    city: station.city,
    department: station.department,
    lat,
    lng,
    connectors,
    station_status: station.stationStatus as MapCharger['station_status'],
  };
}

// ── Fetch ────────────────────────────────────────────────────

const UTE_ENDPOINT = 'https://movilidad.ute.com.uy/api/v1/station/status/map';

/**
 * Fetch all UTE public charging stations and normalize to MapCharger[].
 * Throws on network/API errors — caller should catch and degrade to P2P-only.
 */
export async function fetchUTEChargers(): Promise<MapCharger[]> {
  const res = await fetch(UTE_ENDPOINT, {
    headers: { uniqueKeyUser: 'nginx' },
  });

  if (!res.ok) {
    throw new Error(`UTE API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as FTEResponse;

  // Defensive: warn if the API shape changed unexpectedly.
  if (!Array.isArray(json)) {
    console.warn('[UTE] Unexpected response shape — expected array, got', typeof json);
    return [];
  }

  const chargers = json
    .map(normalizeUTESation)
    .filter((c): c is MapCharger => c !== null);

  return chargers;
}
