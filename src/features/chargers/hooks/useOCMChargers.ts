/**
 * useOCMChargers — TanStack Query hook for Open Charge Map stations.
 *
 * Gated behind the OCM_CHARGERS feature flag. When disabled,
 * the query never fires (enabled: false). On error, returns []
 * so the map degrades to P2P+UTE without crashing.
 *
 * OCM data is relatively static — staleTime 5 min, gcTime 30 min.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { isFeatureEnabled } from '@/lib/features';
import { fetchOCMChargers } from '@/features/chargers/ocm/fetchOCMChargers';

import type { MapCharger } from '../types';

const OCM_QUERY_KEY = ['chargers', 'ocm'] as const;

/**
 * Fetch OCM public charging stations.
 * Returns empty array on error (graceful degradation).
 */
export function useOCMChargers() {
  return useQuery<MapCharger[], Error>({
    queryKey: OCM_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchOCMChargers();
      } catch (err) {
        console.warn('[useOCMChgrs] OCM fetch failed, degrading to P2P+UTE:', err);
        return [];
      }
    },
    enabled: isFeatureEnabled('OCM_CHARGERS'),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}
