/**
 * useCharger — fetch a single charger by id, joined with the host
 * profile. Queries real Supabase data.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';
import type { Charger } from '../types';

/**
 * Public host shape returned by the hook. Matches the columns
 * selected from `public.profiles` by the Supabase join.
 */
export interface ChargerHost {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** ISO 8601 — `profiles.created_at`. */
  createdAt: string;
}

/**
 * Charger joined with its host profile. The hook always returns
 * this shape (never the bare `Charger`) so the screen reads a
 * single object without a second round-trip.
 */
export interface ChargerWithHost extends Charger {
  host: ChargerHost;
}

const QUERY_KEY = (id: string) => ['charger', id] as const;

export interface UseChargerResult {
  data: ChargerWithHost | undefined;
  isLoading: boolean;
  error: AppError | null;
}

/**
 * Single charger lookup with the host profile inlined.
 *
 *   const { data, isLoading, error, refetch } = useCharger(id);
 *
 * Pass `null` or `undefined` to render the screen's "missing id"
 * state without firing a query (the `enabled` gate is `false` in
 * that case).
 */
export function useCharger(
  id: string | null | undefined,
): UseQueryResult<ChargerWithHost, AppError> {
  return useQuery<ChargerWithHost, AppError>({
    queryKey: id ? QUERY_KEY(id) : ['charger', 'anonymous'],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) {
        throw new AppError({
          code: 'no_id',
          message: 'useCharger called without an id',
          userMessage: 'No encontramos este cargador.',
          retryable: false,
        });
      }

      const { data, error } = await supabase
        .from('chargers')
        .select('*, host:profiles!owner_id(id, full_name, avatar_url, created_at)')
        .eq('id', id)
        .single();

      if (error || !data) {
        throw normalizeSupabaseError(error);
      }

      // Supabase returns snake_case — map to our ChargerWithHost shape
      const charger = data as unknown as Charger;
      const rawHost = (data as any).host;

      if (!rawHost) {
        throw new AppError({
          code: 'host_not_found',
          message: `Host profile not found for charger ${id}`,
          userMessage: 'No encontramos la información del anfitrión.',
          retryable: false,
        });
      }

      return {
        ...charger,
        host: {
          id: rawHost.id,
          displayName: rawHost.full_name ?? 'Anfitrión',
          avatarUrl: rawHost.avatar_url ?? null,
          createdAt: rawHost.created_at ?? new Date().toISOString(),
        },
      };
    },
    staleTime: 5 * 60_000,
  });
}
