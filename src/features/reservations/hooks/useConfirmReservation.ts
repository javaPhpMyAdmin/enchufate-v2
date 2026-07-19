/**
 * useConfirmReservation — mutation that flips a reservation from
 * `solicitada` to `confirmada` (host only).
 *
 * **Phase 7 (this commit — REAL Supabase path, MOCK-fallback)**:
 *   - In MOCK mode, the hook just returns successfully so the
 *     UI flow can be exercised without a live Supabase instance.
 *     The mock list is updated in place so the detail screen
 *     reads the new status on its next refetch.
 *   - In real mode, the hook does an `UPDATE` on
 *     `public.reservations` (RLS enforces `host_id = auth.uid()`
 *     via `reservations_update_party` + the underlying
 *     `is_charger_owner` check). The
 *     `handle_reservation_confirmed_system_message` trigger in
 *     `supabase/migrations/20260719000007_triggers.sql` injects
 *     the voseo system message into the conversation
 *     automatically. We do NOT call the `system-message-injector`
 *     Edge Function here — the trigger owns the message.
 *
 * Client-side guard: we call `state-machine.canTransition(...)`
 * BEFORE the network call so an invalid transition surfaces as a
 * typed `AppError` (`code: 'invalid_transition'`) instead of a
 * 4xx RLS response. The user-facing copy is the voseo "Esta
 * reserva ya no se puede confirmar" line.
 *
 * The `notify-reservation-confirmed` Edge Function (Phase 7 task
 * 7.5) is invoked in v2.1 when push notifications land; for MVP
 * we don't call it.
 *
 * Gated by `isFeatureEnabled('RESERVATIONS')`.
 */
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

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

export interface UseConfirmReservationResult {
  confirm: (reservationId: string, currentStatus: ReservationStatus) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useConfirmReservation(): UseConfirmReservationResult {
  const { user } = useSession();
  const qc = useQueryClient();

  const mutation: UseMutationResult<void, AppError, { id: string; currentStatus: ReservationStatus }> =
    useMutation<void, AppError, { id: string; currentStatus: ReservationStatus }>({
      mutationFn: async ({ id, currentStatus }) => {
        if (!isFeatureEnabled('RESERVATIONS')) {
          throw new AppError({
            code: 'feature_disabled',
            message: 'RESERVATIONS feature flag is off',
            userMessage: 'Las reservas no están disponibles en este momento.',
            retryable: false,
          });
        }
        if (!user?.id) {
          throw new AppError({
            code: 'no_user',
            message: 'useConfirmReservation called without an authed user',
            userMessage: 'Necesitás iniciar sesión para confirmar una reserva.',
            isAuthError: true,
            retryable: false,
          });
        }

        // Client-side state-machine guard. Avoids the round-trip
        // when the renter taps a button that should be disabled
        // (e.g. confirmed -> confirm). The server still
        // double-checks via RLS + the `handle_reservation_completed`
        // trigger.
        if (!canTransition(currentStatus, 'confirmada', 'host')) {
          throw new AppError({
            code: 'invalid_transition',
            message: `Cannot transition ${currentStatus} -> confirmada by host`,
            userMessage: 'Esta reserva ya no se puede confirmar.',
            retryable: false,
          });
        }

        if (isMockSupabase()) {
          // ----- MOCK data path -----
          // Update the mock list in place so the detail screen's
          // refetch reads the new status. We do not enforce the
          // host check in mock mode (no RLS).
          const found = MOCK_RESERVATIONS.find((r) => r.id === id);
          if (found) {
            found.status = 'confirmada';
            found.updated_at = new Date().toISOString();
          }
          return;
        }

        // ----- REAL Supabase path -----
        // RLS enforces `host_id = auth.uid()` via
        // `is_charger_owner(charger_id)`. The host's id is on the
        // charger, not the reservation, so we cannot filter by
        // user.id here directly; the RLS check handles it.
        //
        // The `as any` cast is temporary until
        // `src/lib/database.types.ts` is regenerated via
        // `supabase gen types typescript` after the user runs the
        // migrations. See the equivalent note in
        // `useCreateReservation.ts`.
        const updatePayload = { status: 'confirmada' } as never;
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
          queryClient.invalidateQueries({ queryKey: ['conversations'] }),
          // The system-message-injector / triggers update the
          // message list — invalidate the messages list too so
          // any open thread refreshes.
          queryClient.invalidateQueries({ queryKey: ['messages'] }),
        ]);
        // Local qc ref kept for the legacy useReservations /
        // useReservation refetch via the singleton's
        // invalidateQueries — same call, just to make sure the
        // hook's own subscription refetches.
        void qc.invalidateQueries({ queryKey: ['reservation', vars.id] });
      },
    });

  return {
    confirm: (id, currentStatus) => mutation.mutateAsync({ id, currentStatus }),
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
