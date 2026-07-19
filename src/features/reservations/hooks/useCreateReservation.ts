/**
 * useCreateReservation — mutation that submits a new reservation
 * request.
 *
 * **Phase 7 (this commit — REAL Supabase path, MOCK-fallback)**:
 *   - When `EXPO_PUBLIC_MOCK_SUPABASE === 'true'` (or no anon key
 *     is in `.env`), the hook returns a synthetic reservation id
 *     and pushes a stub reservation onto `MOCK_RESERVATIONS` so
 *     the existing mock-first flow keeps working.
 *   - When the env var is `'false'` AND an anon key is set, the
 *     hook calls `supabase.from('reservations').insert(...)` with
 *     the renter's id, the charger's id, and the host's id
 *     (fetched from `public.chargers.owner_id` in a preflight
 *     SELECT — the client never invents the host).
 *
 * The `handle_reservation_created` + `handle_reservation_requested_
 * system_message` triggers in
 * `supabase/migrations/20260719000007_triggers.sql` create the
 * conversation and inject the first system message automatically.
 * We do NOT call the `system-message-injector` Edge Function here
 * — that function is for the confirm/cancel transitions (per
 * `design.md §9.2`).
 *
 * Gated by `isFeatureEnabled('RESERVATIONS')` so the entire flow
 * can be killed in one place.
 *
 * Errors are normalized to `AppError` via `normalizeSupabaseError`.
 * The Zod parse failure case is special-cased so a bad payload
 * surfaces as a typed `AppError` (`code: 'validation'`) instead of
 * leaking a Zod error to the UI.
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import { reservationInputSchema, type ReservationCreateInput } from '@/lib/schemas/reservation';
import { supabase } from '@/lib/supabase';

import { useSession } from '@/features/auth/hooks/useSession';

import { MOCK_RESERVATIONS } from '../data/mockReservations';

/**
 * MOCK_SUPABASE runtime flag — per the Phase 7 brief, every new
 * hook ships with this guard. Default: mock ON when the env var
 * is unset OR no anon key is configured. Live mode requires the
 * user to set `EXPO_PUBLIC_MOCK_SUPABASE=false` in `.env`.
 */
const isMockSupabase = (): boolean =>
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_MOCK_SUPABASE === 'true';

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

        // ----- 1. Validate the client-side payload via Zod -----
        // The schema encodes the hybrid time-storage rule and the
        // `end_at > start_at` constraint. A parse failure throws
        // a typed `validation` AppError so the sheet can show a
        // friendly voseo error before the round-trip.
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

        if (isMockSupabase()) {
          // ----- MOCK data path -----
          // Synthesize an id, push a stub reservation onto the
          // mock list. The mock doesn't fire the SQL triggers, so
          // the conversation is hardcoded to the first mock
          // conversation id — matches the existing pattern in
          // `data/mockReservations.ts` where every reservation
          // has a paired `conversation_id` for the "Chatear" CTA.
          const reservationId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          MOCK_RESERVATIONS.push({
            id: reservationId,
            charger_id: args.chargerId,
            charger_title: 'Cargador (mock)',
            charger_address: '—',
            charger_lat: 0,
            charger_lng: 0,
            charger_power_kw: 22,
            charger_connector_type: 'tipo_2',
            renter_id: user.id,
            renter_name: 'Usuario Demo',
            renter_avatar_url: null,
            host_id: 'mock-host',
            host_name: 'Anfitrión (mock)',
            host_avatar_url: null,
            start_at: args.startAt,
            end_at: args.endAt,
            horario_a_coordinar: args.horarioACoordinar,
            status: 'solicitada',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            conversation_id: 'c1d2e3f4-0001-4000-8000-000000000001',
          });
          return { reservationId };
        }

        // ----- REAL Supabase path -----
        // Preflight: read the charger's owner_id so the INSERT
        // can write the correct host_id. RLS lets any signed-in
        // user SELECT `public.chargers` (the `select_active`
        // policy covers active chargers).
        //
        // The `as any` casts on `.from(...)` are temporary until
        // `src/lib/database.types.ts` is regenerated with
        // `supabase gen types typescript` after the user runs the
        // migrations. The placeholder `Database` generic
        // (`Record<string, never>`) is strict-empty by design;
        // the casts make the real-mode path type-check without
        // hand-editing the generated file.
        const chargerResult = (await (supabase
          .from('chargers' as never)
          .select('id, owner_id')
          .eq('id', args.chargerId)
          .maybeSingle() as unknown as Promise<{ data: { id: string; owner_id: string } | null; error: unknown }>));
        if (chargerResult.error) throw normalizeSupabaseError(chargerResult.error);
        const charger = chargerResult.data;
        if (!charger) {
          throw new AppError({
            code: 'charger_not_found',
            message: `Charger ${args.chargerId} not found`,
            userMessage: 'No encontramos este cargador.',
            retryable: false,
          });
        }

        const insertPayload = {
          charger_id: args.chargerId,
          renter_id: user.id,
          host_id: charger.owner_id,
          start_at: args.startAt,
          end_at: args.endAt,
          horario_a_coordinar: args.horarioACoordinar,
          // status defaults to 'solicitada' server-side; we
          // don't write it explicitly so the RLS
          // `insert_self` policy's `with check status =
          // 'solicitada'` always matches.
        } as never;
        const insertResult = (await (supabase
          .from('reservations' as never)
          .insert(insertPayload)
          .select('id')
          .single() as unknown as Promise<{ data: { id: string } | null; error: unknown }>));
        if (insertResult.error) throw normalizeSupabaseError(insertResult.error);
        if (!insertResult.data?.id) {
          throw new AppError({
            code: 'unknown',
            message: 'insert returned no id',
            userMessage: 'No pudimos crear la reserva. Intentá de nuevo.',
            retryable: true,
          });
        }
        return { reservationId: insertResult.data.id };
      },
      onSuccess: () => {
        // Invalidate the renter + host lists (the `['reservations']`
        // key covers both segmented control tabs in
        // useReservations) and the conversations list (the
        // trigger created a new conversation).
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ['reservations'] }),
          queryClient.invalidateQueries({ queryKey: ['conversations'] }),
        ]);
      },
    });

  return {
    create: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error ? normalizeSupabaseError(mutation.error) : null,
    reset: mutation.reset,
  };
}
