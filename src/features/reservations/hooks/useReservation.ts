/**
 * useReservation — fetch a single reservation by id.
 *
 * **Phase 5 (this commit)**: looks up the matching mock in
 * `MOCK_RESERVATIONS`. Phase 7 swaps the `queryFn` for
 * `.from('reservations').select('*, charger:chargers(*),
 * renter:profiles!renter_id(*), host:profiles!host_id(*)').eq(
 * 'id', id).maybeSingle()`.
 *
 * Throws an `AppError` with `code: 'not_found'` when the
 * reservation doesn't exist so the detail screen can render its
 * "Reserva no encontrada" error state.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';

import { MOCK_RESERVATIONS } from '../data/mockReservations';
import type { Reservation } from '../types';

const QUERY_KEY = (id: string) => ['reservation', id] as const;

export interface UseReservationResult {
  data: Reservation | undefined;
  isLoading: boolean;
  error: AppError | null;
}

/** Single reservation by id. */
export function useReservation(
  id: string | null | undefined,
): UseQueryResult<Reservation, AppError> {
  const enabled = Boolean(id) && isFeatureEnabled('RESERVATIONS');

  return useQuery<Reservation, AppError>({
    queryKey: id ? QUERY_KEY(id) : ['reservation', 'anonymous'],
    enabled,
    queryFn: async () => {
      if (!id) {
        throw new AppError({
          code: 'no_id',
          message: 'useReservation called without an id',
          userMessage: 'No encontramos esta reserva.',
          retryable: false,
        });
      }
      if (!isFeatureEnabled('RESERVATIONS')) {
        throw new AppError({
          code: 'reservations_disabled',
          message: 'RESERVATIONS feature flag is off',
          userMessage: 'Las reservas no están disponibles en este momento.',
          retryable: false,
        });
      }
      await new Promise((r) => setTimeout(r, 200));
      const found = MOCK_RESERVATIONS.find((r) => r.id === id);
      if (!found) {
        throw new AppError({
          code: 'not_found',
          message: `Reservation ${id} not found`,
          userMessage: 'No encontramos esta reserva.',
          retryable: false,
        });
      }
      return found;
    },
    staleTime: 15_000,
  });
}
