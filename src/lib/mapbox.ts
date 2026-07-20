/**
 * Safe MapBox wrapper — prevents the entire app from crashing
 * when @rnmapbox/maps native module is unavailable (Expo Go,
 * stale dev client, or cold start before TurboModules register).
 *
 * IMPORTANT: We use `import` (not require) because @rnmapbox/maps
 * is a pure ESM package. The require() pattern fails to resolve
 * the default export under Metro.
 *
 * The `initMapbox()` function MUST be called from a useEffect
 * (after mount) — NOT at module scope — so the native bridge
 * is ready before we access the module.
 *
 * Usage:
 *   import { isMapboxReady, initMapbox } from '@/lib/mapbox';
 *   // in useEffect: initMapbox();
 *   // in render: if (!isMapboxReady()) return <Fallback />;
 */
import MapboxGL from '@rnmapbox/maps';

let _ready = false;

/**
 * Initialize MapBox with the access token from env.
 * Call once from a useEffect in the root layout.
 * Safe to call multiple times (idempotent).
 */
export function initMapbox(): void {
  if (_ready) return;
  try {
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    if (token && MapboxGL?.setAccessToken) {
      MapboxGL.setAccessToken(token);
      _ready = true;
    }
  } catch {
    // Native module not available — map screens will show fallback.
    _ready = false;
  }
}

/** Whether MapBox was initialized successfully. */
export function isMapboxReady(): boolean {
  return _ready;
}

/** The MapboxGL instance (may be undefined if native module missing). */
export { MapboxGL };
