/**
 * UTE API client — fetches and normalizes UTE public charging stations
 * into MapCharger[].
 *
 * Endpoint: https://movilidad.ute.com.uy/api/v1/station/status/map
 * Auth: unauthenticated, but requires a `uniqueKeyUser: nginx` header.
 *
 * The API returns `{ data: [...] }` with live station status and connector
 * details. We normalize into MapCharger[] so the map can render UTE
 * alongside P2P chargers.
 */
import type { ConnectorInfo, ConnectorType, MapCharger } from '../types';

// ── Raw UTE API response types ─────────────────────────────

interface UTEConnectorStatus {
  count?: number;
  /** e.g. "CCS2", "Tipo 2", "GB/T" */
  type?: string;
  power?: number;
  /** Numeric: 1 = Busy, 2 = Available, etc. */
  status?: number;
  /** e.g. "Busy", "Available", "Unknown" */
  statusDetail?: string;
  /** Whether the connector has an attached cable */
  hose?: boolean;
}

interface UTEServiceStation {
  source?: string;
  name?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  connectorStatusAcc?: UTEConnectorStatus[];
  department?: string;
  city?: string;
  /** e.g. "Cargando", "Disponible", "Fuera de servicio" */
  status?: string;
}

interface FTEResponse {
  data: UTEServiceStation[];
}

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

// ── Status mapping ──────────────────────────────────────────

const STATION_STATUS_MAP: Record<string, MapCharger['station_status']> = {
  Disponible: 'operational',
  Cargando: 'operational', // default/placeholder — not real-time status
  'Fuera de servicio': 'offline',
};

// ── Normalization ────────────────────────────────────────────

/**
 * Normalize a single UTE station into a MapCharger.
 * Returns null when lat/lng are missing or invalid.
 */
function normalizeUTESation(station: UTEServiceStation): MapCharger | null {
  const lat = station.lat;
  const lng = station.lng;

  // Exclude stations with null/invalid coordinates.
  if (lat == null || lng == null || lat === 0 || lng === 0) {
    console.warn('[UTE] Excluding station with null/zero coords:', station.name);
    return null;
  }

  const connectors: ConnectorInfo[] = (station.connectorStatusAcc ?? []).map((c) => {
    const rawType = c.type ?? '';
    const type = CONNECTOR_MAP[rawType];

    if (type === undefined) {
      console.warn(`[UTE] Unknown connector type: "${rawType}" in station "${station.name}"`);
    }

    return {
      type: type ?? 'tipo_2',
      power_kw: c.power ?? 0,
      count: c.count ?? 1,
      has_cable: c.hose ?? true,
      status: c.statusDetail?.toLowerCase() === 'available'
        ? 'available'
        : c.statusDetail?.toLowerCase() === 'busy'
          ? 'occupied'
          : undefined,
    };
  });

  const rawStatus = station.status ?? '';
  const stationStatus = STATION_STATUS_MAP[rawStatus] ?? 'operational';

  return {
    id: `ute-${station.name?.replace(/\s+/g, '-').toLowerCase() ?? 'unknown'}`,
    source: 'ute',
    title: station.name ?? 'Estación UTE',
    address: station.address ?? '',
    city: station.city,
    department: station.department,
    lat,
    lng,
    connectors,
    station_status: stationStatus,
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
  const stations = json.data;
  if (!Array.isArray(stations)) {
    console.warn('[UTE] Unexpected response shape — expected data array, got', typeof json.data);
    return [];
  }

  const chargers = stations
    .map(normalizeUTESation)
    .filter((c): c is MapCharger => c !== null);

  return chargers;
}
