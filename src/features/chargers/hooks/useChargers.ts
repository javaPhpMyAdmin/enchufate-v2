/**
 * useChargers — merging hook that orchestrates parallel Supabase (P2P)
 * and UTE (public) charger fetches, normalizes both to MapCharger[],
 * and applies all filters uniformly.
 *
 * The UTE query is gated behind the PUBLIC_CHARGERS feature flag.
 * When disabled, only P2P chargers are returned.
 *
 * Architecture:
 *   useSupabaseChargers(filters)  ← Supabase query (status filter server-side)
 *   useUTEChargers()              ← UTE fetch (enabled by flag)
 *   useMemo: normalize → merge → apply all client-side filters
 */
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { normalizeSupabaseError } from '@/lib/error';
import { getCurrentPosition, URUGUAY_FALLBACK } from '@/lib/location';
import { supabase } from '@/lib/supabase';

import type { Charger, ConnectorInfo, MapCharger } from '../types';
import type { MapFilters } from '@/stores/filterStore';
import { useUTEChargers } from './useUTEChargers';

const QUERY_KEY_ROOT = ['chargers'] as const;

/** Power ranges (kW) for potencia filter labels. */
const POWER_RANGES: Record<string, { min: number; max: number }> = {
  lenta: { min: 0, max: 7 },
  semi_rapida: { min: 7, max: 22 },
  rapida: { min: 22, max: 50 },
  ultra: { min: 50, max: 999 },
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
 * Normalize a Supabase Charger record into a MapCharger.
 */
function normalizeToMapCharger(c: Charger): MapCharger {
  const connector: ConnectorInfo = {
    type: c.connector_type,
    power_kw: c.power_kw,
    count: 1,
  };
  return {
    id: c.id,
    source: 'enchufate',
    title: c.title,
    address: c.address,
    lat: c.lat,
    lng: c.lng,
    connectors: [connector],
    price_per_hour_usd: c.price_per_hour_usd,
    currency: c.currency,
    status: c.status,
    owner_id: c.owner_id,
  };
}

/**
 * Internal hook — Supabase charger fetch with server-side status filter.
 * Returns raw Charger[] (not normalized to MapCharger).
 */
function useSupabaseChargers(filters?: MapFilters) {
  return useQuery<Charger[], Error>({
    queryKey: filters ? [...QUERY_KEY_ROOT, filters] : QUERY_KEY_ROOT,
    queryFn: async () => {
      let query = supabase
        .from('chargers')
        .select('*')
        .order('created_at', { ascending: false });

      // Server-side status filter
      if (filters?.estado === 'pausado') {
        query = query.eq('status', 'paused');
      } else {
        query = query.eq('status', 'active');
      }

      const { data, error } = await query;

      if (error) throw normalizeSupabaseError(error);

      return (data ?? []) as unknown as Charger[];
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * useChargers — the main merging hook.
 *
 * Returns MapCharger[] from both Supabase (P2P) and UTE (public) sources.
 * All filters (source, connector, power, distance) are applied client-side
 * in useMemo after the merge.
 */
export function useChargers(
  filters?: MapFilters,
): UseQueryResult<MapCharger[], Error> {
  const supabaseQuery = useSupabaseChargers(filters);
  const uteQuery = useUTEChargers();

  // Cache user position for synchronous distance filtering in useMemo.
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const [userPosReady, setUserPosReady] = useState(false);

  useEffect(() => {
    getCurrentPosition().then((pos) => {
      userPosRef.current = pos
        ? { lat: pos.lat, lng: pos.lng }
        : { lat: URUGUAY_FALLBACK.lat, lng: URUGUAY_FALLBACK.lng };
      setUserPosReady(true);
    });
  }, []);

  const data = useMemo(() => {
    const p2p = (supabaseQuery.data ?? []).map(normalizeToMapCharger);
    const ute = uteQuery.data ?? [];
    let merged = [...p2p, ...ute];

    // ── Source filter ──────────────────────────────────────
    if (filters?.fuente === 'enchufate') {
      merged = merged.filter((c) => c.source === 'enchufate');
    }
    if (filters?.fuente === 'ute') {
      merged = merged.filter((c) => c.source === 'ute');
    }

    // ── Connector filter (matches any connector in connectors[]) ──
    if (filters?.conector) {
      merged = merged.filter((c) =>
        c.connectors.some((conn) => conn.type === filters.conector),
      );
    }

    // ── Power filter (matches max power across connectors) ──
    if (filters?.potencia) {
      const range = POWER_RANGES[filters.potencia];
      if (range) {
        merged = merged.filter((c) => {
          const maxPower = Math.max(...c.connectors.map((conn) => conn.power_kw), 0);
          return maxPower >= range.min && maxPower < range.max;
        });
      }
    }

    // ── Distance filter (Haversine, synchronous via cached position) ──
    if (filters?.distancia && userPosRef.current) {
      const maxKm = DISTANCE_RANGES[filters.distancia];
      if (maxKm) {
        const { lat: userLat, lng: userLng } = userPosRef.current;
        merged = merged.filter((c) => {
          const dist = haversine(userLat, userLng, c.lat, c.lng);
          return dist <= maxKm;
        });
      }
    }

    return merged;
  }, [supabaseQuery.data, uteQuery.data, filters, userPosReady]);

  // Spread supabaseQuery to satisfy UseQueryResult shape, then override data.
  return {
    ...supabaseQuery,
    data,
    isLoading: supabaseQuery.isLoading || uteQuery.isLoading,
    error: supabaseQuery.error ?? uteQuery.error,
    isPlaceholderData: supabaseQuery.isPlaceholderData || uteQuery.isPlaceholderData,
  } as unknown as UseQueryResult<MapCharger[], Error>;
}
