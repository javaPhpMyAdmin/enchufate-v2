/**
 * useCreateReservation — mutation that creates a new reservation.
 *
 * Inserts into `public.reservations` with `horario_a_coordinar`
 * (quick duration picker) or structured `start_at`/`end_at`.
 *
 * The `handle_reservation_created` + `handle_reservation_requested_
 * system_message` triggers create the conversation and inject
 * the first system message automatically.
 *
 * After success, invalidates `['reservations']` and
 * `['conversations']` so both lists refresh.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import { reservationInputSchema, type ReservationCreateInput } from '@/lib/schemas/reservation';
import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/push';

import { useSession } from '@/features/auth/hooks/useSession';

export interface CreateReservationArgs {
  chargerId: string;
  /** ISO 8601 — null when the renter chose "horario a coordinar". */
  startAt: string | null;
  /** ISO 8601 — null when the renter chose "horario a coordinar". */
  endAt: string | null;
  /** Free-text fallback — null when the renter picked a structured time. */
  horarioACoordinar: string | null;
}

export interface CreateReservationResult {
  reservationId: string;
}

export interface UseCreateReservationResult {
  // eslint-disable-next-line no-unused-vars
  create: (args: CreateReservationArgs) => Promise<CreateReservationResult>;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

export function useCreateReservation(): UseCreateReservationResult {
  const { user } = useSession();

  const mutation: UseMutationResult<CreateReservationResult, AppError, CreateReservationArgs> =
    useMutation<CreateReservationResult, AppError, CreateReservationArgs>({
      mutationFn: async (args) => {
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
            message: 'useCreateReservation called without an authed user',
            userMessage: 'Necesitás iniciar sesión para reservar.',
            isAuthError: true,
            retryable: false,
          });
        }

        // Validate via Zod — hybrid time-storage rule.
        const input: ReservationCreateInput = {
          charger_id: args.chargerId,
          renter_id: user.id,
          start_at: args.startAt,
          end_at: args.endAt,
          horario_a_coordinar: args.horarioACoordinar,
        };
        try {
          reservationInputSchema.parse(input);
        } catch (zodErr) {
          throw new AppError({
            code: 'validation',
            message: zodErr instanceof Error ? zodErr.message : 'reservationInputSchema.parse failed',
            userMessage:
              'Revisá el horario de la reserva. Elegí una hora de inicio y fin, o usá "Horario a coordinar".',
            retryable: false,
          });
        }

        // Insert — the trigger handles host_id + conversation creation.
        const { data, error } = await supabase
          .from('reservations')
          .insert({
            charger_id: args.chargerId,
            renter_id: user.id,
            start_at: args.startAt,
            end_at: args.endAt,
            horario_a_coordinar: args.horarioACoordinar,
          })
          .select('id')
          .single();

        if (error) throw normalizeSupabaseError(error);
        if (!data?.id) {
          throw new AppError({
            code: 'unknown',
            message: 'insert returned no id',
            userMessage: 'No pudimos crear la reserva. Intentá de nuevo.',
            retryable: true,
          });
        }
        return { reservationId: data.id };
      },
      onSuccess: (_data, vars) => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reservations'] }),
          queryClient.invalidateQueries({ queryKey: ['conversations'] }),
        ]);

        // Push notification to the host (fire-and-forget).
        if (isFeatureEnabled('PUSH_NOTIFICATIONS') && user?.id) {
          void (async () => {
            const { data: charger } = await supabase
              .from('chargers')
              .select('owner_id, title')
              .eq('id', vars.chargerId)
              .single();
            if (charger?.owner_id && charger.owner_id !== user.id) {
              await sendPushNotification(
                [charger.owner_id],
                'Nueva reserva',
                `Alguien quiere reservar tu cargador "${charger.title}".`,
              );
            }
          })();
        }
      },
    });

  return {
    create: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
