/**
 * openMaps — pure URL generators for map directions.
 *
 * Shared between ChargerBottomSheet and ChargerDetailScreen so
 * the URL-building logic lives in one place.
 */

export interface MapsUrls {
  /** URL for Google Maps directions with driving mode forced. */
  googleUrl: string;
  wazeUrl: string;
  appleUrl: string;
}

/**
 * Build deep-link URLs for Google Maps, Waze, and Apple Maps
 * given a destination lat/lng and a place name.
 *
 * Google Maps uses the `daddr` format (destination address) with
 * `directionsmode=driving` so it opens directly in driving mode
 * and doesn't show a stale cached route.
 */
export function getMapsUrls(lat: number, lng: number, title: string): MapsUrls {
  const dest = `${lat},${lng}`;
  return {
    googleUrl: `https://maps.google.com/maps?daddr=${dest}&directionsmode=driving`,
    wazeUrl: `https://waze.com/ul?ll=${dest}&navigate=yes&to=ll.${dest}`,
    appleUrl: `https://maps.apple.com/?daddr=${dest}&dirflg=d`,
  };
}
