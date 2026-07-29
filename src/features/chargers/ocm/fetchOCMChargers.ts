/**
 * OCM API client — fetches and normalizes Open Charge Map POIs
 * (Uruguay + Argentina) into MapCharger[].
 *
 * Makes two parallel requests (UY + AR) because OCM's `countrycode`
 * parameter does NOT accept comma-separated values (unlike `operatorid`
 * and `connectiontypeid`).
 *
 * Endpoint: https://api.openchargemap.io/v3/poi/?countrycode=XX&key=...
 * Auth: API key via `process.env.EXPO_PUBLIC_OCM_API_KEY`.
 *
 * **API key setup**: The user must set `EXPO_PUBLIC_OCM_API_KEY` in
 * `.env` (or `.env.local`). Without it, every fetch returns an empty
 * array with a console.warn. Get a free key at
 * https://openchargemap.org/site/register.
 *
 * The raw response is a flat array of POI objects (NOT wrapped in
 * `{ data: [...] }`). We normalize into MapCharger[] so the map can
 * render OCM alongside P2P and UTE chargers.
 */
import type { ConnectorInfo, MapCharger } from '../types';
import { mapOCMConnectionType, mapOCMStatus } from './connectionTypeMap';

// ── Raw OCM API response types ─────────────────────────────

/**
 * Minimal OCM POI shape — only the fields we consume.
 * The full response has many more fields; this keeps the
 * interface lean and focused on our normalization needs.
 */
interface OCMPOI {
  ID: number;
  AddressInfo: {
    Title?: string;
    AddressLine1?: string;
    AddressLine2?: string;
    Town?: string;
    StateOrProvince?: string;
    Latitude?: number | null;
    Longitude?: number | null;
  };
  Connections?: Array<{
    ConnectionTypeID?: number;
    /** kW rating — 0 means unknown */
    PowerKW?: number;
    /** LevelID: 1=Level1(slow), 2=Level2(AC), 3=Level3(DC) */
    LevelID?: number;
    /** Number of connectors of this type at this station */
    Quantity?: number;
  }>;
  /** 50=Operational, 100=Offline, 150=Planned, 200=UnderConstruction */
  StatusTypeID?: number;
}

// ── Country list ────────────────────────────────────────────

const OCM_COUNTRIES = ['UY', 'AR'] as const;

const OCM_BASE_URL = 'https://api.openchargemap.io/v3/poi/' as const;

// ── Helper: infer has_cable from ConnectionTypeID ──────────

/**
 * Some OCM ConnectionTypeIDs encode whether the cable is tethered.
 * For others we have no way to know, so we return undefined.
 */
function inferHasCable(connectionTypeId?: number): boolean | undefined {
  if (connectionTypeId === 1036) return true; // Type 2 Tethered
  if (connectionTypeId === 25) return false; // Type 2 Socket Only
  return undefined; // unknown
}

// ── Helper: infer power from LevelID ────────────────────────

/**
 * When PowerKW is 0 or missing, infer from OCM LevelID.
 *
 * - LevelID 1 → 7 kW (typical Level 1 home charging)
 * - LevelID 2 → 22 kW (typical Level 2 AC charging)
 * - LevelID 3 → 50 kW (typical Level 3 DC fast charging)
 * - Unknown → 0 (cannot infer)
 */
function inferPowerKw(powerKw: number | undefined, levelId?: number): number {
  if (powerKw && powerKw > 0) return powerKw;

  if (levelId === 1) return 7;
  if (levelId === 2) return 22;
  if (levelId === 3) return 50;
  return 0;
}

// ── Normalization ────────────────────────────────────────────

/**
 * Normalize a single OCM POI into a MapCharger.
 * Returns null when lat/lng are missing, null, or exactly 0.
 */
function normalizeOCMStation(poi: OCMPOI): MapCharger | null {
  const lat = poi.AddressInfo.Latitude;
  const lng = poi.AddressInfo.Longitude;

  // Exclude stations with null/invalid coordinates.
  if (lat == null || lng == null || lat === 0 || lng === 0) {
    console.warn(
      `[OCM] Excluding POI ${poi.ID} with null/zero coords: ${poi.AddressInfo.Title}`,
    );
    return null;
  }

  const addressParts = [
    poi.AddressInfo.AddressLine1,
    poi.AddressInfo.AddressLine2,
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : '';

  const connectors: ConnectorInfo[] = (poi.Connections ?? []).map((c) => ({
    type: mapOCMConnectionType(c.ConnectionTypeID),
    power_kw: inferPowerKw(c.PowerKW, c.LevelID),
    count: c.Quantity ?? 1,
    has_cable: inferHasCable(c.ConnectionTypeID),
  }));

  return {
    id: `ocm-${poi.ID}`,
    source: 'ocm',
    title: poi.AddressInfo.Title ?? 'Estación de carga',
    address,
    city: poi.AddressInfo.Town,
    department: poi.AddressInfo.StateOrProvince,
    lat,
    lng,
    connectors,
    station_status: mapOCMStatus(poi.StatusTypeID),
  };
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Fetch OCM POIs for a single country code.
 * Returns raw parsed array, or throws on non-2xx / Cloudflare block.
 */
async function fetchCountry(country: string, apiKey: string): Promise<OCMPOI[]> {
  const url = `${OCM_BASE_URL}?countrycode=${country}&key=${apiKey}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Enchufate/2.0 (Uruguay; +https://enchufate.uy)',
    },
  });

  if (!res.ok) {
    throw new Error(`OCM API error (${country}): ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `OCM returned HTML for ${country} (Cloudflare block)`,
    );
  }

  const json: unknown = await res.json();

  if (!Array.isArray(json)) {
    console.warn(
      `[OCM] Unexpected response shape for ${country} — expected flat array, got`,
      typeof json,
    );
    return [];
  }

  return json as OCMPOI[];
}

// ── Public API ──────────────────────────────────────────────

/**
 * Fetch OCM charging POIs for Uruguay + Argentina and normalize to MapCharger[].
 *
 * Makes two parallel requests (one per country) because OCM's `countrycode`
 * parameter does not support comma-separated values. On partial failure,
 * the failing country returns [] so the other country still loads.
 *
 * Uses `process.env.EXPO_PUBLIC_OCM_API_KEY` for the API key.
 * The request includes a `User-Agent` header — OCM (or Cloudflare
 * in front of it) blocks requests without one.
 *
 * On complete failure, returns an empty array — the caller should
 * degrade gracefully.
 */
export async function fetchOCMChargers(): Promise<MapCharger[]> {
  const apiKey = process.env.EXPO_PUBLIC_OCM_API_KEY;

  if (!apiKey) {
    console.warn(
      '[OCM] EXPO_PUBLIC_OCM_API_KEY is not set — add it to .env or .env.local. ' +
        'Get a free key at https://openchargemap.org/site/register',
    );
    return [];
  }

  // Fire both country requests in parallel.
  const results = await Promise.allSettled(
    OCM_COUNTRIES.map((cc) => fetchCountry(cc, apiKey)),
  );

  const allPois: OCMPOI[] = [];

  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') {
      allPois.push(...r.value);
    } else {
      const reason = r.reason;
      console.warn(
        `[OCM] Failed to fetch ${OCM_COUNTRIES[i]}: ${reason instanceof Error ? reason.message : String(reason)}`,
      );
    }
  }

  const chargers = allPois
    .map(normalizeOCMStation)
    .filter((c): c is MapCharger => c !== null);

  return chargers;
}
