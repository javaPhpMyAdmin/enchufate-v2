/**
 * useReservations — fetch the signed-in user's reservations.
 *
 * **Phase 5 (this commit)**: filters the hardcoded
 * `MOCK_RESERVATIONS` by `role` (renter = `renter_id === uid`;
 * host = `host_id === uid`). Phase 7 swaps the `queryFn` for
 * `.from('reservations').select('*, charger:chargers(*),
 * renter:profiles!renter_id(*), host:profiles!host_id(*)').or(
 * \`renter_id.eq.${uid},host_id.eq.${uid}\`)` — the signature and
 * call sites stay identical.
 *
 * The `RESERVATIONS` feature flag gates the entire hook: when the
 * flag is off, the hook returns an empty array and `isLoading`
 * flips to `false` immediately. Per `src/lib/features.ts` the
 * flag is `true` in MVP (v2.1 keeps it on).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';

import { MOCK_RESERVATIONS } from '../data/mockReservations';
import type { Reservation, ReservationRole } from '../types';

const QUERY_KEY = (uid: string, role: ReservationRole) =>
  ['reservations', role, uid] as const;

export interface UseReservationsResult {
  data: Reservation[] | undefined;
  isLoading: boolean;
  error: AppError | null;
}

/** Reservations where the current user is renter OR host (filtered by `role`). */
export function useReservations(
  role: ReservationRole,
  userId: string | null | undefined,
): UseQueryResult<Reservation[], AppError> {
  const enabled = Boolean(userId) && isFeatureEnabled('RESERVATIONS');

  return useQuery<Reservation[], AppError>({
    queryKey: userId ? QUERY_KEY(userId, role) : ['reservations', role, 'anonymous'],
    enabled,
    queryFn: async () => {
      if (!userId) {
        throw new AppError({
          code: 'no_user',
          message: 'useReservations called without a user id',
          userMessage: 'Necesitás iniciar sesión para ver tus reservas.',
          isAuthError: true,
          retryable: false,
        });
      }
      if (!isFeatureEnabled('RESERVATIONS')) {
        return [];
      }
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_RESERVATIONS.filter((r) =>
        role === 'renter' ? r.renter_id === userId : r.host_id === userId,
      );
    },
    staleTime: 15_000,
  });
}
