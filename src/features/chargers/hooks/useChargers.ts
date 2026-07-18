/**
 * useChargers — TanStack Query hook for the charger list.
 *
 * **Phase 4 (this commit)**: returns the hardcoded `MOCK_CHARGERS`
 * array from `../data/mockChargers` with a 200ms artificial delay
 * to simulate network latency and exercise the loading state. This
 * lets the user preview the Mapa + Inicio surfaces in Expo Go
 * without a fresh Supabase anon key (the V1 key was revoked; the
 * new V2 key is still pending — see `security/enchufate-v2-blocked-
 * on-key`).
 *
 * **Phase 6 (next)**: replace the `queryFn` body with
 * `supabase.from('chargers').select('*').eq('status', 'active')`
 * (RLS will scope to public + own). The hook signature, query key,
 * and `filters` plumbing stay identical so the call sites in the
 * map and list screens don't change.
 *
 * The optional `filters` argument is currently a no-op (the mock
 * returns every charger) but it IS included in the query key so
 * when filters change, the cache key changes too — this means
 * Phase 6's real queryFn will trigger a refetch automatically as
 * soon as the filters are wired in, with zero call-site changes.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Charger } from '../types';
import { MOCK_CHARGERS } from '../data/mockChargers';
import type { MapFilters } from '@/stores/filterStore';

export interface UseChargersResult {
  data: Charger[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

const QUERY_KEY_ROOT = ['chargers'] as const;

/**
 * Fetch the charger list, optionally filtered. Returns a TanStack
 * Query result with `data`, `isLoading`, and `error` for the screen
 * to read.
 *
 *   const { data, isLoading, error } = useChargers(filters);
 */
export function useChargers(
  filters?: MapFilters,
): UseQueryResult<Charger[], Error> {
  return useQuery<Charger[], Error>({
    queryKey: filters ? [...QUERY_KEY_ROOT, filters] : QUERY_KEY_ROOT,
    queryFn: async () => {
      // Simulate network latency so the LoadingState atom is visible
      // in the Mapa screen preview.
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_CHARGERS;
    },
    staleTime: 30_000,
  });
}
