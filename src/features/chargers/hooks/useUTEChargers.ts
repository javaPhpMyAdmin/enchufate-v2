/**
 * useUTEChargers — TanStack Query hook for UTE public charger stations.
 *
 * Gated behind the PUBLIC_CHARGERS feature flag. When disabled,
 * the query never fires (enabled: false). On error, returns []
 * so the map degrades to P2P-only without crashing.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isFeatureEnabled } from '@/lib/features';
import { fetchUTEChargers } from '@/features/chargers/ute/fetchUTEChargers';

const UTE_QUERY_KEY = ['chargers', 'ute'] as const;

/**
 * Fetch UTE public charger stations.
 * Returns empty array on error (graceful degradation).
 */
export function useUTEChargers() {
  return useQuery({
    queryKey: UTE_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchUTEChargers();
      } catch (err) {
        console.warn('[useUTEChgrs] UTE fetch failed, degrading to P2P-only:', err);
        return [];
      }
    },
    enabled: isFeatureEnabled('PUBLIC_CHARGERS'),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
