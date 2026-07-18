/**
 * Location helper — `expo-location` thin wrapper.
 *
 * Per `design.md §8.3`, location is requested ONLY on the Mapa
 * screen's first mount (and on Publicar step 2 mount — that lands
 * in Phase 6). There is no app-start prompt.
 *
 * Two paths from the caller's perspective:
 *   1. `requestLocationPermission()` — prompts once. Returns
 *      `'granted' | 'denied' | 'undetermined'`. No throw on deny.
 *   2. `getCurrentPosition()` — assumes permission is granted (caller
 *      just asked). Resolves to `{ lat, lng }` on success or `null`
 *      on failure (caller can fall back to Uruguay).
 *
 * The Uruguay fallback constant is exported so the Mapa screen and
 * the FiltersSheet can reference the same coordinates when location
 * is unavailable.
 */
import * as Location from 'expo-location';

export const URUGUAY_FALLBACK = {
  lat: -34.9011,
  lng: -56.1645,
  zoom: 11,
} as const;

export type PermissionResult = 'granted' | 'denied' | 'undetermined';

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Prompt the user for foreground location permission. Returns the
 * permission status. The caller is expected to handle `denied` and
 * `undetermined` (fall back to the Uruguay constant).
 *
 * On the web platform `expo-location` is a no-op; the helper returns
 * `'denied'` so callers can fall back to Uruguay uniformly.
 */
export async function requestLocationPermission(): Promise<PermissionResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    // Web (expo-location returns a no-op) or runtime error. Treat as
    // denied so the map falls back to Uruguay.
    return 'denied';
  }
}

/**
 * Read the current device location. Resolves to `null` on any
 * failure (permission missing, timeout, hardware error) so the
 * caller can show the Uruguay fallback without try/catch noise.
 *
 * Uses `Accuracy.Balanced` per the design — enough precision for
 * "center the map on the user" without burning battery on GPS.
 */
export async function getCurrentPosition(): Promise<Coordinates | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Read the last known position from the OS cache. Faster than
 * `getCurrentPosition` (no fix requested) but may be null or stale.
 * Use this when the FAB is tapped and we want a snappy recenter.
 *
 * Note: `getLastKnownPositionAsync` (expo-location 19.x) does NOT
 * accept an `accuracy` option — it returns whatever the OS cached
 * with no filtering. That's fine for a "recenter on last known
 * position" gesture; we just accept whatever quality we get.
 */
export async function getLastKnownPosition(): Promise<Coordinates | null> {
  try {
    const pos = await Location.getLastKnownPositionAsync({});
    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
