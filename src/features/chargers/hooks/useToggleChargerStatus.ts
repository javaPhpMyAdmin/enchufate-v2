/**
 * useToggleChargerStatus — mutation that toggles a charger between
 * `active` and `paused` (owner only).
 *
 * Before the DB update the hook queries for confirmed reservations
 * (`status = 'confirmada'`) on this charger. If any exist, the
 * mutation throws an `AppError({ code: 'active_reservations' })`
 * so the UI can show an inline alert.
 *
 * On success the hook invalidates:
 *   - `['charger', chargerId]`  → detail screen refreshes
 *   - `['chargers']`           → map list refreshes
 *   - `['my-chargers', userId]` → profile list refreshes
 *
 * The hook is NOT gated behind a feature flag — the DB enum
 * `charger_status` (`active | paused`) and RLS policies already
 * exist. This is a pure UI + mutation feature.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { useSession } from '@/features/auth/hooks/useSession';

import type { ChargerStatus } from '../types';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export interface UseToggleChargerStatusResult {
  toggle: (args: { chargerId: string; currentStatus: ChargerStatus }) => Promise<void>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useToggleChargerStatus(): UseToggleChargerStatusResult {
  const { user } = useSession();

  const mutation: UseMutationResult<
    void,
    AppError,
    { chargerId: string; currentStatus: ChargerStatus }
  > = useMutation<
    void,
    AppError,
    { chargerId: string; currentStatus: ChargerStatus }
  >({
    mutationFn: async ({ chargerId, currentStatus }) => {
      // ----- 1. Auth check -----
      if (!user?.id) {
        throw new AppError({
          code: 'no_user',
          message: 'useToggleChargerStatus called without an authed user',
          userMessage: 'Necesitás iniciar sesión para gestionar tu cargador.',
          isAuthError: true,
          retryable: false,
        });
      }

      // ----- 2. Ownership + current status verification -----
      const { data: charger, error: fetchErr } = await supabase
        .from('chargers')
        .select('owner_id, status')
        .eq('id', chargerId)
        .single();

      if (fetchErr) throw normalizeSupabaseError(fetchErr);
      if (!charger) {
        throw new AppError({
          code: 'not_found',
          message: `Charger ${chargerId} not found`,
          userMessage: 'No encontramos este cargador.',
          retryable: false,
        });
      }
      if (charger.owner_id !== user.id) {
        throw new AppError({
          code: 'forbidden',
          message: `User ${user.id} is not owner of charger ${chargerId}`,
          userMessage: 'No tenés permiso para editar este cargador.',
          retryable: false,
        });
      }

      // ----- 3. Reservation guard -----
      // Block toggle when there are confirmed reservations for this
      // charger. Client-side pre-check mirrors the existing pattern
      // in useUpdateCharger. MVP accepts the small race window.
      const { count, error: countErr } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('charger_id', chargerId)
        .eq('status', 'confirmada');

      if (countErr) throw normalizeSupabaseError(countErr);
      if (count && count > 0) {
        throw new AppError({
          code: 'active_reservations',
          message: `Charger ${chargerId} has ${count} confirmed reservation(s)`,
          userMessage:
            'No podés pausar el cargador porque tiene reservas confirmadas. Esperá a que se completen o cancelalas primero.',
          retryable: false,
        });
      }

      // ----- 4. Toggle status -----
      const newStatus: ChargerStatus = currentStatus === 'active' ? 'paused' : 'active';

      const { error: updateErr } = await supabase
        .from('chargers')
        .update({ status: newStatus } as never)
        .eq('id', chargerId);

      if (updateErr) throw normalizeSupabaseError(updateErr);

      // ----- 5. Query invalidation -----
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['charger', chargerId] }),
        queryClient.invalidateQueries({ queryKey: ['chargers'] }),
        queryClient.invalidateQueries({ queryKey: ['my-chargers', user.id] }),
      ]);
    },
  });

  return {
    toggle: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
