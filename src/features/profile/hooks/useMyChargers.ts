/**
 * useMyChargers — chargers owned by the current user.
 * Queries real Supabase data filtered by owner_id.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Charger } from '@/features/chargers/types';
import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

const QUERY_KEY = (uid: string) => ['my-chargers', uid] as const;

/** Chargers owned by the current user. */
export function useMyChargers(
  userId: string | null | undefined,
): UseQueryResult<Charger[], AppError> {
  return useQuery<Charger[], AppError>({
    queryKey: userId ? QUERY_KEY(userId) : ['my-chargers', 'anonymous'],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        throw new AppError({
          code: 'no_user',
          message: 'useMyChargers called without a user id',
          userMessage: 'Necesitás iniciar sesión para ver tus cargadores.',
          isAuthError: true,
          retryable: false,
        });
      }

      const { data, error } = await supabase
        .from('chargers')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw normalizeSupabaseError(error);
      return (data ?? []) as unknown as Charger[];
    },
    staleTime: 30_000,
  });
}
