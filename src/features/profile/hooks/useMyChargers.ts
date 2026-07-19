/**
 * useMyChargers — chargers owned by the current user.
 *
 * **Phase 5 (this commit)**: returns the hardcoded `MOCK_MY_CHARGERS`
 * array. The query key includes the `userId` so when Phase 6 swaps
 * in `.from('chargers').select().eq('owner_id', uid).eq('status',
 * 'active')` the cache invalidates correctly on sign-in / sign-out
 * and when the user publishes a new charger (the publish wizard
 * calls `queryClient.invalidateQueries({ queryKey: ['my-chargers',
 * uid] })` on success).
 *
 * `staleTime: 30_000` matches the global default; the per-query
 * override is here so future tweaks (e.g. realtime invalidation on
 * charger `UPDATE`) only need to touch one file.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Charger } from '@/features/chargers/types';
import { AppError } from '@/lib/error';

import { MOCK_MY_CHARGERS } from '../data/mockMyChargers';

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
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_MY_CHARGERS;
    },
    staleTime: 30_000,
  });
}
