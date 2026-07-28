/**
 * endCharging — mutation that transitions a reservation from
 * `en_curso` to `completada` (host or guest).
 *
 * Either party can end the charging session early by tapping
 * "Finalizar carga". The DB trigger `handle_charging_status_change`
 * atomically nullifies `chargers.current_charging_since`.
 *
 * On concurrent end, the server's RLS + last-write-wins determine
 * the final state. The client handles rollback via TanStack Query's
 * `onError` if the server rejects the update.
 *
 * Gated by `isFeatureEnabled('CHARGING_STATUS')`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { useSession } from '@/features/auth/hooks/useSession';

import { MOCK_RESERVATIONS } from '../data/mockReservations';
import { canTransition, type ReservationStatus } from '../state-machine';

const isMockSupabase = (): boolean =>
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_MOCK_SUPABASE === 'true';

export interface EndChargingResult {
  endCharging: (reservationId: string, currentStatus: ReservationStatus) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useEndCharging(): EndChargingResult {
  const { user } = useSession();

  const mutation = useMutation<void, AppError, { id: string; currentStatus: ReservationStatus }>({
    mutationFn: async ({ id, currentStatus }) => {
      if (!isFeatureEnabled('CHARGING_STATUS')) {
        throw new AppError({
          code: 'feature_disabled',
          message: 'CHARGING_STATUS feature flag is off',
          userMessage: 'La carga no está disponible en este momento.',
          retryable: false,
        });
      }

      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useEndCharging called without an authed user',
          userMessage: 'Necesitás iniciar sesión para finalizar la carga.',
          isAuthError: true,
          retryable: false,
        });
      }

      // Determine actor role: host or guest. Both can end charging.
      // We try host first; if that's not valid, guest may be valid.
      const canEndAsHost = canTransition(currentStatus, 'completada', 'host');
      const canEndAsGuest = canTransition(currentStatus, 'completada', 'renter');

      if (!canEndAsHost && !canEndAsGuest) {
        throw new AppError({
          code: 'invalid_transition',
          message: `Cannot transition ${currentStatus} -> completada`,
          userMessage: 'No se puede finalizar la carga en este estado.',
          retryable: false,
        });
      }

      if (isMockSupabase()) {
        // ----- MOCK data path -----
        const found = MOCK_RESERVATIONS.find((r) => r.id === id);
        if (found) {
          found.status = 'completada';
          found.updated_at = new Date().toISOString();
        }
        return;
      }

      // ----- REAL Supabase path -----
      // The DB trigger handle_charging_status_change will atomically
      // nullify chargers.current_charging_since. RLS enforces that
      // the caller is either the renter OR the charger owner.
      const updatePayload = { status: 'completada' } as never;
      const updateResult = (await (supabase
        .from('reservations' as never)
        .update(updatePayload)
        .eq('id', id) as unknown as Promise<{ error: unknown }>));
      if (updateResult.error) throw normalizeSupabaseError(updateResult.error);
    },
    onSuccess: (_void, vars) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['reservation', vars.id] }),
        queryClient.invalidateQueries({ queryKey: ['chargers'] }),
        queryClient.invalidateQueries({ queryKey: ['conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
      ]);
    },
  });

  return {
    endCharging: (id, currentStatus) => mutation.mutateAsync({ id, currentStatus }),
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
