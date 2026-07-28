/**
 * startCharging — mutation that transitions a reservation from
 * `confirmada` to `en_curso` (host only).
 *
 * The host taps "Iniciar carga" when the guest plugs in. This
 * sets `status = 'en_curso'` and `charging_started_at = now()`.
 * The DB trigger `handle_charging_status_change` then updates
 * `chargers.current_charging_since` atomically, and the
 * `handle_charging_started_system_message` trigger injects the
 * system message into the conversation.
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

export interface StartChargingResult {
  startCharging: (reservationId: string, currentStatus: ReservationStatus) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useStartCharging(): StartChargingResult {
  const { user } = useSession();
  const qc = useQueryClient();

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
          message: 'useStartCharging called without an authed user',
          userMessage: 'Necesitás iniciar sesión para iniciar la carga.',
          isAuthError: true,
          retryable: false,
        });
      }

      // Client-side state-machine guard: only host can start charging
      // from `confirmada`.
      if (!canTransition(currentStatus, 'en_curso', 'host')) {
        throw new AppError({
          code: 'invalid_transition',
          message: `Cannot transition ${currentStatus} -> en_curso by host`,
          userMessage: 'No se puede iniciar la carga en este estado.',
          retryable: false,
        });
      }

      if (isMockSupabase()) {
        // ----- MOCK data path -----
        const found = MOCK_RESERVATIONS.find((r) => r.id === id);
        if (found) {
          found.status = 'en_curso';
          found.updated_at = new Date().toISOString();
        }
        return;
      }

      // ----- REAL Supabase path -----
      // The DB trigger handle_charging_status_change will atomically
      // update chargers.current_charging_since. RLS enforces that
      // the caller is the charger owner via is_charger_owner().
      const now = new Date().toISOString();
      const updatePayload = {
        status: 'en_curso',
        charging_started_at: now,
      } as never;
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
      void qc.invalidateQueries({ queryKey: ['reservation', vars.id] });
    },
  });

  return {
    startCharging: (id, currentStatus) => mutation.mutateAsync({ id, currentStatus }),
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
