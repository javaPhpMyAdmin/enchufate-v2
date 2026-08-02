/**
 * Geocoding utilities — reverse geocode + coordinate detection.
 *
 * Some chargers were published before reverse geocoding was reliable,
 * so their `address` field contains raw coordinates like "-34.9012, -56.2090".
 * This module detects that pattern and resolves a human-readable address.
 */
import * as Location from 'expo-location';

/**
 * Matches "-34.9012, -56.2090" or "-34.9, -56.2" (with or without
 * spaces, 1-8 decimal digits). 1-8 (not 2-8) so a partially edited
 * fallback like "-34.9, -56.2" is still caught — a host trimming
 * the decimals must not bypass the publish guard.
 *
 * MUST stay byte-identical to `v_coord_pattern` in
 * `supabase/migrations/20260802000001_fix_confirmed_message_address.sql`
 * — the server trigger uses the same pattern to keep raw coordinates
 * out of system messages, so a mismatch would classify the same
 * string differently on each side.
 */
const COORD_REGEX = /^-?\d{1,3}\.\d{1,8}\s*,\s*-?\d{1,3}\.\d{1,8}$/;

/**
 * Returns true when `address` looks like raw lat/lng coordinates
 * instead of a human-readable street address.
 */
export function isCoordinateAddress(address: string): boolean {
  // Callers can pass undefined (e.g. an optional charger field);
  // guard so a non-string never throws on .trim().
  if (typeof address !== 'string') return false;
  return COORD_REGEX.test(address.trim());
}

/** Fallback: raw coordinates as address string. */
function coordsAsAddress(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * Reverse geocode lat/lng into a human-readable address.
 * Falls back to raw coordinates when the API returns nothing or errors.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const [result] = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });
    if (!result) return coordsAsAddress(lat, lng);
    const parts = [result.street, result.name, result.city, result.region].filter(Boolean);
    return parts.join(', ') || coordsAsAddress(lat, lng);
  } catch {
    return coordsAsAddress(lat, lng);
  }
}
