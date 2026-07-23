/**
 * useCancelReservation — mutation that flips a reservation to
 * `cancelada` (renter or host).
 *
 * **Phase 7 (this commit — REAL Supabase path, MOCK-fallback)**:
 *   - In MOCK mode, the hook updates the in-memory list so the
 *     detail screen + the reservations list reflect the new
 *     status on the next refetch.
 *   - In real mode, the hook does an `UPDATE` on
 *     `public.reservations` with `status = 'cancelada'` and
 *     `cancelled_by = auth.uid()`. RLS enforces
 *     `renter_id = auth.uid() OR is_charger_owner(charger_id)`
 *     via `reservations_update_party`. The
 *     `handle_reservation_cancelled_system_message` trigger in
 *     `supabase/migrations/20260719000007_triggers.sql` injects
 *     the voseo system message with the formatted `time_desc`.
 *
 * Client-side guard: `state-machine.isCancellable(...)` runs
 * BEFORE the network call so an already-cancelled or completed
 * reservation surfaces a typed `AppError` (`code:
 * 'invalid_transition'`) instead of a 4xx RLS response.
 *
 * The optional `reason` is captured for future analytics / push
 * notification copy (v2.1); for MVP it is dropped (the schema has
 * no `cancellation_reason` column).
 *
 * Gated by `isFeatureEnabled('RESERVATIONS')`.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/push';

import { useSession } from '@/features/auth/hooks/useSession';

import { MOCK_RESERVATIONS } from '../data/mockReservations';
import { isCancellable, type ReservationStatus } from '../state-machine';

const isMockSupabase = (): boolean =>
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_MOCK_SUPABASE === 'true';

export interface UseCancelReservationResult {
  // The parameter name is preserved for IDE intellisense on the
  // public hook API. ESLint's bare `no-unused-vars` rule flags
  // it as unused because the parameter is part of a function
  // type, not a real call site. The disabled line below is the
  // narrowest way to silence the warning without renaming.
  // eslint-disable-next-line no-unused-vars
  cancel: (reservationId: string, currentStatus: ReservationStatus, reason?: string) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useCancelReservation(): UseCancelReservationResult {
  const { user } = useSession();

  const mutation: UseMutationResult<
    void,
    AppError,
    { id: string; currentStatus: ReservationStatus; reason?: string }
  > = useMutation<void, AppError, { id: string; currentStatus: ReservationStatus; reason?: string }>({
    // eslint-disable-next-line no-unused-vars
    mutationFn: async ({ id, currentStatus, reason: _reason }) => {
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
          message: 'useCancelReservation called without an authed user',
          userMessage: 'Necesitás iniciar sesión para cancelar una reserva.',
          isAuthError: true,
          retryable: false,
        });
      }

      // Client-side state-machine guard. `isCancellable` returns
      // true for `solicitada` and `confirmada`; false for the
      // terminal states `cancelada` and `completada`.
      if (!isCancellable(currentStatus)) {
        throw new AppError({
          code: 'invalid_transition',
          message: `Cannot cancel a reservation in status ${currentStatus}`,
          userMessage: 'Esta reserva ya no se puede cancelar.',
          retryable: false,
        });
      }

      if (isMockSupabase()) {
        // ----- MOCK data path -----
        const found = MOCK_RESERVATIONS.find((r) => r.id === id);
        if (found) {
          found.status = 'cancelada';
          found.updated_at = new Date().toISOString();
        }
        return;
      }

      // ----- REAL Supabase path -----
      // RLS enforces `renter_id = auth.uid() OR is_charger_owner`.
      // The cancelled_by audit field is set to the authed user
      // (renter or host).
      //
      // The `as any` cast is temporary until
      // `src/lib/database.types.ts` is regenerated via
      // `supabase gen types typescript` after the user runs the
      // migrations. See the equivalent note in
      // `useCreateReservation.ts`.
      const updatePayload = { status: 'cancelada', cancelled_by: user.id } as never;
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
        queryClient.invalidateQueries({ queryKey: ['messages'] }),
      ]);

      // Push notification to the OTHER party (fire-and-forget).
      if (isFeatureEnabled('PUSH_NOTIFICATIONS') && user?.id) {
        void (async () => {
          const { data: reservation } = await supabase
            .from('reservations')
            .select('renter_id, charger_id')
            .eq('id', vars.id)
            .single();
          if (!reservation) return;

          // Figure out who the OTHER party is.
          // If I'm the renter → notify the host (via charger owner).
          // If I'm the host → notify the renter.
          let notifyUserId: string | null = null;
          if (reservation.renter_id === user.id) {
            // I'm the renter — find the host via charger.
            const { data: charger } = await supabase
              .from('chargers')
              .select('owner_id')
              .eq('id', reservation.charger_id)
              .single();
            notifyUserId = charger?.owner_id ?? null;
          } else {
            // I'm the host — notify the renter.
            notifyUserId = reservation.renter_id;
          }

          if (notifyUserId && notifyUserId !== user.id) {
            await sendPushNotification(
              [notifyUserId],
              'Reserva cancelada',
              'Una reserva fue cancelada.',
            );
          }
        })();
      }
    },
  });

  return {
    cancel: (id, currentStatus, reason) => mutation.mutateAsync({ id, currentStatus, reason }),
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
