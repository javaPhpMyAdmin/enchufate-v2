/**
 * useChargers — TanStack Query hook for the charger list.
 * Queries real Supabase data with server-side filters for status,
 * connector type, power range, and price range. Distance filtering
 * is applied client-side using the user's location.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { normalizeSupabaseError } from '@/lib/error';
import { getCurrentPosition, URUGUAY_FALLBACK } from '@/lib/location';
import { supabase } from '@/lib/supabase';

import type { Charger } from '../types';
import type { MapFilters } from '@/stores/filterStore';

export interface UseChargersResult {
  data: Charger[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

const QUERY_KEY_ROOT = ['chargers'] as const;

/** Power ranges (kW) for potencia filter labels. */
const POWER_RANGES: Record<string, { min: number; max: number }> = {
  lenta: { min: 0, max: 7 },
  semi_rapida: { min: 7, max: 22 },
  rapida: { min: 22, max: 50 },
  ultra: { min: 50, max: 999 },
};

/** Price ranges ($/hour) for precio filter labels. */
const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  economico: { min: 0, max: 5 },
  estandar: { min: 5, max: 15 },
  premium: { min: 15, max: 999 },
};

/** Distance ranges (km) for client-side filtering. */
const DISTANCE_RANGES: Record<string, number> = {
  cerca: 2,
  medio: 10,
  lejos: 50,
};

/** Haversine distance between two lat/lng points (km). */
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fetch the charger list, optionally filtered. Server-side filters
 * (status, connector, power, price) are applied via Supabase query
 * builder. Distance is filtered client-side after fetch.
 *
 *   const { data, isLoading, error } = useChargers(filters);
 */
export function useChargers(
  filters?: MapFilters,
): UseQueryResult<Charger[], Error> {
  return useQuery<Charger[], Error>({
    queryKey: filters ? [...QUERY_KEY_ROOT, filters] : QUERY_KEY_ROOT,
    queryFn: async () => {
      let query = supabase
        .from('chargers')
        .select('*')
        .order('created_at', { ascending: false });

      // ── Server-side filters ──────────────────────────────────

      // Estado: default to active only; if 'pausado' is selected,
      // fetch paused chargers (owner view). If 'disponible', active.
      if (filters?.estado === 'pausado') {
        query = query.eq('status', 'paused');
      } else {
        // Default: active chargers (covers null and 'disponible')
        query = query.eq('status', 'active');
      }

      // Connector type
      if (filters?.conector) {
        query = query.eq('connector_type', filters.conector);
      }

      // Power range
      if (filters?.potencia) {
        const range = POWER_RANGES[filters.potencia];
        if (range) {
          query = query
            .gte('power_kw', range.min)
            .lt('power_kw', range.max);
        }
      }

      // Price range
      if (filters?.precio) {
        const range = PRICE_RANGES[filters.precio];
        if (range) {
          query = query
            .gte('price_per_hour_usd', range.min)
            .lt('price_per_hour_usd', range.max);
        }
      }

      const { data, error } = await query;

      if (error) throw normalizeSupabaseError(error);

      let chargers = (data ?? []) as unknown as Charger[];

      // ── Client-side distance filter ──────────────────────────

      if (filters?.distancia) {
        const maxKm = DISTANCE_RANGES[filters.distancia];
        if (maxKm) {
          // Get user's real location, fallback to Montevideo center
          const userPos = await getCurrentPosition();
          const userLat = userPos?.lat ?? URUGUAY_FALLBACK.lat;
          const userLng = userPos?.lng ?? URUGUAY_FALLBACK.lng;

          chargers = chargers.filter((c) => {
            const dist = haversine(userLat, userLng, c.lat, c.lng);
            return dist <= maxKm;
          });
        }
      }

      return chargers;
    },
    staleTime: 30_000,
  });
}
