/**
 * useResolvedAddress — resolves a charger address to human-readable form.
 *
 * If the stored address already looks like a street address, returns it
 * immediately (zero cost). If it looks like raw coordinates, runs a
 * reverse geocode and caches the result via TanStack Query.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { isCoordinateAddress, reverseGeocode } from '@/lib/geocode';

/**
 * Returns the human-readable address for a charger.
 *
 * @param storedAddress - The raw `address` from the chargers table.
 * @param lat - The charger latitude (needed for geocoding fallback).
 * @param lng - The charger longitude (needed for geocoding fallback).
 */
export function useResolvedAddress(
  storedAddress: string,
  lat: number,
  lng: number,
): UseQueryResult<string, Error> {
  const needsGeocoding = isCoordinateAddress(storedAddress);

  return useQuery<string, Error>({
    queryKey: ['resolved-address', lat, lng],
    queryFn: () => reverseGeocode(lat, lng),
    // Only fetch when the address looks like coordinates
    enabled: needsGeocoding,
    // Cache aggressively — addresses don't change
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    gcTime: 7 * 24 * 60 * 60 * 1000,
    // Return stored address immediately while geocoding in background
    placeholderData: needsGeocoding ? storedAddress : undefined,
  });
}
