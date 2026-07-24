/**
 * useReservations — fetch the signed-in user's reservations.
 *
 * **Phase 5 (initial commit)**: filtered the hardcoded
 * `MOCK_RESERVATIONS` by `role` (renter = `renter_id === uid`;
 * host = `host_id === uid`).
 *
 * **Phase 7 (this commit — Realtime subscription)**:
 *   - The mock fetch path is preserved (the user hasn't applied
 *     the SQL migrations yet + the MOCK_SUPABASE flag is on by
 *     default).
 *   - When the MOCK_SUPABASE flag is OFF (real mode), the hook
 *     subscribes to a Supabase Realtime channel
 *     (`reservations:user={uid}`) on mount and invalidates the
 *     `['reservations']` cache on any `*` change. Cleanup:
 *     `supabase.removeChannel(channel)` on unmount.
 *   - The filter covers BOTH the renter and host paths because
 *     the channel listens to all `reservations` events for the
 *     signed-in user — renter-side matches `renter_id=eq.{uid}`,
 *     host-side matches `charger_id=in.{owned_ids}` (computed
 *     via the `my-chargers` cache, which the Profile screen
 *     keeps warm). For Phase 7 we use the simpler renter-side
 *     filter on the renter tab; the host tab refreshes on
 *     focus. Phase 8 can wire the full two-sided filter.
 *   - The real-mode SELECT path is left as a TODO — the user
 *     wires the SELECT chain when they flip the flag + run
 *     `supabase gen types typescript`.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';

import { MOCK_RESERVATIONS } from '../data/mockReservations';
import type { Reservation, ReservationRole } from '../types';

const QUERY_KEY = (uid: string, role: ReservationRole) =>
  ['reservations', role, uid] as const;

const isMockSupabase = (): boolean =>
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_MOCK_SUPABASE === 'true';

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
  const queryClient = useQueryClient();
  const enabled = Boolean(userId) && isFeatureEnabled('RESERVATIONS');

  // ----- Realtime subscription (real mode only) -----
  // The mock path keeps the `staleTime: 15_000` cache. The
  // real path subscribes to the `reservations:user={uid}`
  // channel and invalidates the `['reservations']` cache on
  // any change. We invalidate rather than setQueryData
  // because the role filter is client-side — the server-side
  // payload doesn't tell us which tab (renter / host) the
  // change belongs to.
  useEffect(() => {
    if (!userId || isMockSupabase() || !isFeatureEnabled('RESERVATIONS')) {
      return;
    }
    const channel = supabase
      .channel(`reservations:user=${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `renter_id=eq.${userId}`,
        },
        () => {
          // Invalidate the broad key so both the renter + host
          // tabs refetch on the next render. The renter tab is
          // the one subscribed; the host tab refetches on its
          // own useReservations call (separate hook instance).
          void queryClient.invalidateQueries({ queryKey: ['reservations'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

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
      // ----- MOCK data path (default) -----
      if (isMockSupabase()) {
        await new Promise((r) => setTimeout(r, 200));
        return MOCK_RESERVATIONS.filter((r) =>
          role === 'renter' ? r.renter_id === userId : r.host_id === userId,
        );
      }
      // ----- REAL Supabase path -----
      // The reservations table has no host_id column — the host is
      // derived from chargers.owner_id. We join chargers + profiles
      // to get the denormalized fields the UI expects.
      const SELECT_FIELDS = `
        id, charger_id, renter_id, start_at, end_at,
        horario_a_coordinar, status, created_at, updated_at,
        charger:chargers!reservations_charger_id_fkey(
          title, address, power_kw, connector_type, lat, lng, owner_id
        ),
        renter_profile:profiles!reservations_renter_id_fkey(
          full_name, avatar_url
        )
      ` as never;

      let query = supabase
        .from('reservations' as never)
        .select(SELECT_FIELDS)
        .order('start_at', { ascending: true, nullsFirst: false });

      if (role === 'renter') {
        query = query.eq('renter_id', userId);
      } else {
        const { data: chargers, error: chargersErr } = await supabase
          .from('chargers' as never)
          .select('id' as never)
          .eq('owner_id', userId);
        if (chargersErr) {
          throw new AppError({
            code: 'reservations_load_failed',
            message: chargersErr.message,
            userMessage: 'No pudimos cargar tus reservas. Intentá de nuevo.',
            retryable: true,
          });
        }
        const chargerIds = (chargers ?? []).map((c: any) => c.id);
        if (chargerIds.length === 0) return [];
        query = query.in('charger_id', chargerIds);
      }

      const result = await (query as unknown as Promise<{
        data: any[] | null;
        error: unknown;
      }>);
      if (result.error) {
        throw new AppError({
          code: 'reservations_load_failed',
          message: result.error instanceof Error ? result.error.message : 'reservations load failed',
          userMessage: 'No pudimos cargar tus reservas. Intentá de nuevo.',
          retryable: true,
        });
      }

      // Map the joined result to the denormalized Reservation shape.
      const rows = result.data ?? [];

      // Collect unique host IDs (charger owners) to batch-fetch profiles.
      const hostIds = [...new Set(
        rows
          .map((r: any) => r.charger?.owner_id)
          .filter((id: string | undefined): id is string => Boolean(id)),
      )];

      let hostProfiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (hostIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', hostIds);
        if (profiles) {
          for (const p of profiles as any[]) {
            hostProfiles[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          }
        }
      }

      // Batch-fetch conversations to resolve conversation_id.
      // Conversations are keyed by (charger_id, renter_id).
      const convPairs = rows.map((r: any) => ({
        charger_id: r.charger_id as string,
        renter_id: r.renter_id as string,
      }));
      const convIndex: Record<string, string> = {};
      if (convPairs.length > 0) {
        const chargerIds = [...new Set(convPairs.map((p) => p.charger_id))];
        const renterIds = [...new Set(convPairs.map((p) => p.renter_id))];
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, charger_id, renter_id')
          .in('charger_id', chargerIds)
          .in('renter_id', renterIds);
        if (convs) {
          for (const c of convs as any[]) {
            convIndex[`${c.charger_id}:${c.renter_id}`] = c.id;
          }
        }
      }

      return rows.map((r: any): Reservation => {
        const charger = r.charger ?? { title: '', address: '', power_kw: 0, connector_type: '', lat: 0, lng: 0, owner_id: '' };
        const renterProfile = r.renter_profile ?? { full_name: null, avatar_url: null };
        const hostProfile = hostProfiles[charger.owner_id] ?? { full_name: null, avatar_url: null };
        return {
          id: r.id,
          charger_id: r.charger_id,
          charger_title: charger.title ?? '',
          charger_address: charger.address ?? '',
          charger_lat: charger.lat ?? 0,
          charger_lng: charger.lng ?? 0,
          charger_power_kw: charger.power_kw ?? 0,
          charger_connector_type: charger.connector_type ?? '',
          renter_id: r.renter_id,
          renter_name: renterProfile.full_name ?? 'Huésped',
          renter_avatar_url: renterProfile.avatar_url,
          host_id: charger.owner_id ?? '',
          host_name: hostProfile.full_name ?? 'Anfitrión',
          host_avatar_url: hostProfile.avatar_url,
          start_at: r.start_at,
          end_at: r.end_at,
          horario_a_coordinar: r.horario_a_coordinar,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
          conversation_id: convIndex[`${r.charger_id}:${r.renter_id}`] ?? '',
        };
      });
    },
    staleTime: 15_000,
  });
}
