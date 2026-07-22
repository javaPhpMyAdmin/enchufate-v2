/**
 * useChargers — TanStack Query hook for the charger list.
 * Queries real Supabase data filtered by active status.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

import type { Charger } from '../types';
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
      const { data, error } = await supabase
        .from('chargers')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw normalizeSupabaseError(error);
      return (data ?? []) as unknown as Charger[];
    },
    staleTime: 30_000,
  });
}
