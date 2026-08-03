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
 *  - When the MOCK_SUPABASE flag is OFF (real mode), the hook
 *     subscribes to a Supabase Realtime channel
 *     (`reservations:user={uid}` + unique suffix, see below) on
 *     mount and invalidates the
 *     `['reservations']` cache on any `*` change. Cleanup:
 *     `supabase.removeChannel(channel)` on unmount.
 *  - The filter covers BOTH the renter and host paths with a
 *    two-sided `or(...)` filter: `renter_id = eq.{uid}` covers the
 *    renter side; `charger_id = in.(owned_ids)` covers the host
 *    side (owned ids resolved from `chargers.owner_id` — the
 *    reservations table has no host column). Re-subscribing on
 *    `role` change keeps the owned-charger set fresh. Before this
 *    fix the channel only listened to the renter side, so host-side
 *    events (guest books/cancels on the host's charger) never
 *    invalidated the host tab.
 *   - The real-mode SELECT path is left as a TODO — the user
 *     wires the SELECT chain when they flip the flag + run
 *     `supabase gen types typescript`.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { uniqueChannelId } from '@/lib/realtime';
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
  // The mock path keeps the `staleTime: 15_000` cache. The real
  // path subscribes to a TWO-SIDED `postgres_changes` filter so
  // events on BOTH sides of the reservation invalidate the cache:
  //   - renter side: `renter_id = eq.{uid}`
  //   - host side:   `charger_id = in.(owned ids)` — the user's
  //     chargers, resolved once per subscription from
  //     `chargers.owner_id` (the reservations table has no host
  //     column). Degrades to renter-only when the user owns no
  //     chargers.
  // `role` is in the effect deps so switching the segmented tab
  // re-subscribes and re-resolves the owned-charger set (a host may
  // publish new chargers between visits). We invalidate rather than
  // setQueryData because the server-side payload doesn't tell us
  // which tab (renter / host) the change belongs to — the role
  // filter is client-side in the queryFn.
  //
  // The channel name embeds `uniqueChannelId()` so every effect run
  // registers a brand-new channel. `supabase.channel(name)` returns an
  // already-subscribed channel when the name is reused, and calling
  // `.on(...)` on it throws "cannot add `postgres_changes` callbacks
  // ... after `subscribe()`". The name must stay unique because this
  // effect re-runs (React StrictMode double-invoke in dev, or `userId`
  // / `role` changing).
  useEffect(() => {
    if (!userId || isMockSupabase() || !isFeatureEnabled('RESERVATIONS')) {
      return;
    }
    const uid: string = userId;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    // The host-side half of the filter needs the user's charger ids.
    // Resolve them before subscribing; if the user owns no chargers
    // yet, the filter degrades to the renter-only half.
    void (async () => {
      const { data: chargers } = await supabase
        .from('chargers')
        .select('id')
        .eq('owner_id', uid);
      if (cancelled) return;

      const ownedIds = (chargers ?? []).map((c) => c.id);
      const filter =
        ownedIds.length > 0
          ? `or=(renter_id.eq.${uid},charger_id.in.(${ownedIds.join(',')}))`
          : `renter_id.eq.${uid}`;

      channel = supabase
        .channel(`reservations:user=${uid}:${uniqueChannelId()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
            filter,
          },
          () => {
            // Invalidate the broad key so both the renter + host
            // tabs refetch on the next render.
            void queryClient.invalidateQueries({ queryKey: ['reservations'] });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId, role, queryClient]);

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
        horario_a_coordinar, charging_started_at, cancel_reason, status, created_at, updated_at,
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
          charger_power_kw: Number(charger.power_kw ?? 0),
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
          charging_started_at: r.charging_started_at ?? null,
          cancel_reason: r.cancel_reason ?? null,
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
