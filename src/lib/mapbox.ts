/**
 * Safe MapBox wrapper — prevents the entire app from crashing
 * when @rnmapbox/maps native module is unavailable (Expo Go,
 * stale dev client, or cold start before TurboModules register).
 *
 * Usage: import { MapboxGL, isMapboxAvailable } from '@/lib/mapbox';
 */
import type MapboxGLType from '@rnmapbox/maps';

let _MapboxGL: typeof MapboxGLType | null = null;
let _available = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _MapboxGL = require('@rnmapbox/maps').default;
  _available = !!_MapboxGL?.setAccessToken;
} catch {
  _MapboxGL = null;
  _available = false;
}

/** MapboxGL instance, or null if native module is unavailable. */
export const MapboxGL: typeof MapboxGLType | null = _MapboxGL;

/** Whether MapBox native module loaded successfully. */
export const isMapboxAvailable: boolean = _available;
