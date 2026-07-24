/**
 * useReservation — fetch a single reservation by id.
 *
 * **Mock mode**: looks up the matching mock in `MOCK_RESERVATIONS`.
 * **Real mode**: queries Supabase with JOINs to chargers + profiles
 * to get the denormalized Reservation shape.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';

import { MOCK_RESERVATIONS } from '../data/mockReservations';
import type { Reservation } from '../types';

const QUERY_KEY = (id: string) => ['reservation', id] as const;

const isMockSupabase = (): boolean =>
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_MOCK_SUPABASE === 'true';

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

      // ----- MOCK path -----
      if (isMockSupabase()) {
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
      }

      // ----- REAL Supabase path -----
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, charger_id, renter_id, start_at, end_at,
          horario_a_coordinar, status, created_at, updated_at,
          charger:chargers!reservations_charger_id_fkey(
            title, address, power_kw, connector_type, lat, lng, owner_id
          ),
          renter_profile:profiles!reservations_renter_id_fkey(
            full_name, avatar_url
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        throw new AppError({
          code: 'reservation_load_failed',
          message: error.message,
          userMessage: 'No pudimos cargar la reserva. Intentá de nuevo.',
          retryable: true,
        });
      }

      if (!data) {
        throw new AppError({
          code: 'not_found',
          message: `Reservation ${id} not found`,
          userMessage: 'No encontramos esta reserva.',
          retryable: false,
        });
      }

      // Fetch host profile (charger owner).
      const charger = (data as any).charger ?? {};
      const renterProfile = (data as any).renter_profile ?? { full_name: null, avatar_url: null };
      let hostProfile = { full_name: null as string | null, avatar_url: null as string | null };
      if (charger.owner_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', charger.owner_id)
          .maybeSingle();
        if (profile) {
          hostProfile = { full_name: profile.full_name, avatar_url: profile.avatar_url };
        }
      }

      // Fetch conversation_id (keyed by charger_id + renter_id).
      let conversation_id = '';
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('charger_id', data.charger_id)
        .eq('renter_id', data.renter_id)
        .maybeSingle();
      if (conv) {
        conversation_id = conv.id;
      }

      return {
        id: data.id,
        charger_id: data.charger_id,
        charger_title: charger.title ?? '',
        charger_address: charger.address ?? '',
        charger_lat: charger.lat ?? 0,
        charger_lng: charger.lng ?? 0,
        charger_power_kw: charger.power_kw ?? 0,
        charger_connector_type: charger.connector_type ?? '',
        renter_id: data.renter_id,
        renter_name: renterProfile.full_name ?? 'Huésped',
        renter_avatar_url: renterProfile.avatar_url,
        host_id: charger.owner_id ?? '',
        host_name: hostProfile.full_name ?? 'Anfitrión',
        host_avatar_url: hostProfile.avatar_url,
        start_at: data.start_at,
        end_at: data.end_at,
        horario_a_coordinar: data.horario_a_coordinar,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        conversation_id,
      } satisfies Reservation;
    },
    staleTime: 15_000,
  });
}
