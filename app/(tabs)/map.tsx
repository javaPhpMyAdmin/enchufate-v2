/**
 * Mapa tab — public charger discovery surface (Phase 4).
 *
 * Renders a MapLibre view tiled from OpenFreeMap (no tokens required)
 * centered on Uruguay, with native clustering of charger pins.
 *
 * **Dynamic import**: MapContent (which imports MapLibre's TurboModules)
 * is loaded via a controlled dynamic `import()` in `useEffect` — NOT
 * via `React.lazy`. React.lazy still evaluates the module on first
 * render, which triggers the TurboModule lookup. If the native binary
 * doesn't have `MLRNCameraModule` registered (e.g. stale dev client),
 * the app crashes. The controlled import catches the error and shows
 * a user-friendly retry screen instead.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Linking, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChargers } from '@/features/chargers/hooks/useChargers';
import { useFilterStore } from '@/stores/filterStore';
import {
  URUGUAY_FALLBACK,
  getCurrentPosition,
  getLastKnownPosition,
  requestLocationPermission,
} from '@/lib/location';
import { LoadingState } from '@/components/molecules/LoadingState';
import { ErrorState } from '@/components/molecules/ErrorState';
import { PermissionToast } from '@/components/molecules/PermissionToast';
import { FiltersSheet } from '@/components/organisms/FiltersSheet';
import { ChargerPopup } from '@/components/organisms/ChargerPopup';
import { colors, spacing } from '@/theme';
import type { ChargerSource, ConnectorInfo, ConnectorType, Currency, MapCharger } from '@/features/chargers/types';
import type { MapContentProps } from '@/components/organisms/MapContent';

// ── OSRM polyline routing (free, no API key) ─────────────
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

interface OSRMRoute {
  coords: [number, number][]; // [lng, lat] pairs
  distanceMeters: number;
}

async function fetchRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<OSRMRoute | null> {
  try {
    const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) return null;
    return {
      coords: route.geometry?.coordinates ?? [],
      distanceMeters: route.distance ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Selected charger shape (from GeoJSON properties) ─────────
interface SelectedCharger {
  id: string;
  title: string;
  source: ChargerSource;
  connectors: ConnectorInfo[];
  connectorType: ConnectorType;
  powerKw: number;
  pricePerHour: number;
  currency: Currency;
  lat: number;
  lng: number;
  stationStatus?: 'operational' | 'limited' | 'offline';
}

// ── GeoJSON helpers (no MapLibre dependency) ─────────────────
type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Point>;

function chargersToGeoJSON(chargers: MapCharger[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: chargers.map((c): GeoJSONFeature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        id: c.id,
        title: c.title,
        source: c.source,
        connectors: c.connectors,
        connector_type: c.connectors[0]?.type ?? 'tipo_2',
        power_kw: c.connectors[0]?.power_kw ?? 0,
        status: c.status,
        price_per_hour_usd: c.price_per_hour_usd ?? 0,
        currency: c.currency ?? 'USD',
        lat: c.lat,
        lng: c.lng,
        station_status: c.station_status,
      },
    })),
  };
}

// ── Component ────────────────────────────────────────────────
export default function MapTab() {
  const insets = useSafeAreaInsets();
  const filters = useFilterStore((s) => s.filters);
  const { data, isPlaceholderData, error, refetch } = useChargers(filters);
  const cameraRef = useRef<any>(null);
  const sourceRef = useRef<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCharger, setSelectedCharger] = useState<SelectedCharger | null>(null);
  const [markerScreenCoords, setMarkerScreenCoords] = useState<{ x: number; y: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);
  const [showLocationToast, setShowLocationToast] = useState(false);
  const router = useRouter();

  // Cache user position — one GPS fix per session, reused for all route calculations.
  const userPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Dynamic import state: we control WHEN MapContent is loaded.
  const [MapComponent, setMapComponent] = useState<React.ComponentType<MapContentProps> | null>(null);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  // Load MapContent after interactions complete (post-OAuth redirect
  // may leave TurboModules in a bad state; InteractionManager waits
  // for animations/transitions to finish before we touch native modules).
  useEffect(() => {
    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;

      import('@/components/organisms/MapContent')
        .then((mod) => {
          if (!cancelled) {
            setMapComponent(() => mod.default);
            setMapLoadError(null);
            setMapLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[MapTab] Failed to load MapContent:', msg);
            setMapLoadError(msg);
            setMapLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  // Retry handler when the map failed to load.
  const handleMapRetry = useCallback(() => {
    setMapLoading(true);
    setMapLoadError(null);
    import('@/components/organisms/MapContent')
      .then((mod) => {
        setMapComponent(() => mod.default);
        setMapLoadError(null);
        setMapLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[MapTab] Retry failed:', msg);
        setMapLoadError(msg);
        setMapLoading(false);
      });
  }, []);

  // Request location permission on first mount (Phase 4 spec).
  useEffect(() => {
    requestLocationPermission().then((result) => {
      if (result !== 'granted') {
        setShowLocationToast(true);
      }
      // Pre-cache position for instant route calculation on first tap.
      getCurrentPosition().then((pos) => {
        if (pos) userPositionRef.current = pos;
      });
    });
  }, []);

  const geojson = useMemo(
    () => (data ? chargersToGeoJSON(data) : null),
    [data],
  );

  // Fetch OSRM route when a charger is selected.
  useEffect(() => {
    if (!selectedCharger) {
      setRouteCoords(null);
      setRouteDistanceMeters(null);
      return;
    }
    let cancelled = false;

    const getFrom = async (): Promise<{ lat: number; lng: number }> => {
      if (userPositionRef.current) return userPositionRef.current;
      const pos = await getCurrentPosition();
      const from = pos ?? { lat: URUGUAY_FALLBACK.lat, lng: URUGUAY_FALLBACK.lng };
      if (pos) userPositionRef.current = pos; // cache for next tap
      return from;
    };

    getFrom().then(async (from) => {
      if (cancelled) return;
      const route = await fetchRoute(from.lat, from.lng, selectedCharger.lat, selectedCharger.lng);
      if (!cancelled && route) {
        setRouteCoords(route.coords);
        setRouteDistanceMeters(route.distanceMeters);
      }
    });
    return () => { cancelled = true; };
  }, [selectedCharger?.id]);

  const handleRecenter = useCallback(async () => {
    const last = await getLastKnownPosition();
    const target = last ?? { lat: URUGUAY_FALLBACK.lat, lng: URUGUAY_FALLBACK.lng };
    cameraRef.current?.setCamera({
      centerCoordinate: [target.lng, target.lat],
      zoomLevel: last ? 13 : URUGUAY_FALLBACK.zoom,
      animationMode: 'easeTo',
      animationDuration: 600,
    });
  }, []);

  const handleSourcePress = useCallback(
    async (event: any) => {
      const feature = event.features?.[0] ?? event.nativeEvent?.features?.[0];
      if (!feature?.properties) return;
      const props = feature.properties as Record<string, unknown> & {
        cluster?: boolean;
        cluster_id?: number;
        id?: string;
        title?: string;
        source?: ChargerSource;
        connectors?: ConnectorInfo[];
        connector_type?: ConnectorType;
        power_kw?: number;
        price_per_hour_usd?: number;
        currency?: Currency;
        lat?: number;
        lng?: number;
        station_status?: 'operational' | 'limited' | 'offline';
      };
      if (props.cluster && typeof props.cluster_id === 'number' && sourceRef.current) {
        const coords = feature.geometry?.coordinates as [number, number] | undefined;
        if (coords) {
          const currentZoom = 12;
          cameraRef.current?.setCamera({
            centerCoordinate: coords,
            zoomLevel: currentZoom + 0.5,
            animationMode: 'easeTo',
            animationDuration: 500,
          });
        }
        return;
      }
      if (props.id && props.lat && props.lng) {
        const connectors = props.connectors ?? [];
        setSelectedCharger({
          id: props.id,
          title: props.title ?? 'Cargador',
          source: props.source ?? 'enchufate',
          connectors,
          connectorType: connectors[0]?.type ?? props.connector_type ?? 'tipo_2',
          powerKw: connectors[0]?.power_kw ?? props.power_kw ?? 0,
          pricePerHour: props.price_per_hour_usd ?? 0,
          currency: props.currency ?? 'USD',
          lat: props.lat,
          lng: props.lng,
          stationStatus: props.station_status,
        });
      }
    },
    [],
  );

  // ── Error state (only hard errors, not filter refreshes) ────
  if (error && !geojson) {
    return (
      <ErrorState
        body={error.message || 'No pudimos cargar el mapa. Probá de nuevo.'}
        onRetry={refetch}
      />
    );
  }

  // ── Map failed to load (native module missing) ───────────
  if (mapLoadError) {
    return (
      <ErrorState
        title="Mapa no disponible"
        body="No pudimos cargar el mapa. Es posible que necesites reiniciar la app."
        onRetry={handleMapRetry}
        retryLabel="Reintentar"
      />
    );
  }

  // ── Map still loading ────────────────────────────────────
  if (mapLoading || !MapComponent) {
    return <LoadingState label="Cargando mapa..." />;
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <View style={styles.root}>
      <MapComponent
        geojson={geojson}
        routeCoords={routeCoords}
        selectedChargerCoord={selectedCharger ? [selectedCharger.lng, selectedCharger.lat] : null}
        onRecenter={handleRecenter}
        onSourcePress={handleSourcePress}
        onMarkerScreenCoords={setMarkerScreenCoords}
        insets={insets}
        onFilterPress={() => setSheetOpen(true)}
        cameraRef={cameraRef}
        sourceRef={sourceRef}
        isRefreshing={isPlaceholderData}
      />

      <FiltersSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />

      {selectedCharger ? (
        <ChargerPopup
          title={selectedCharger.title}
          source={selectedCharger.source}
          connectors={selectedCharger.connectors}
          connectorType={selectedCharger.connectorType}
          powerKw={selectedCharger.powerKw}
          pricePerHour={selectedCharger.pricePerHour}
          currency={selectedCharger.currency}
          lat={selectedCharger.lat}
          lng={selectedCharger.lng}
          position={markerScreenCoords}
          routeDistanceMeters={routeDistanceMeters}
          onPressDetail={() => {
            const id = selectedCharger.id;
            setSelectedCharger(null);
            setMarkerScreenCoords(null);
            setRouteCoords(null);
            setRouteDistanceMeters(null);
            router.push(`/charger/${id}` as never);
          }}
          onDismiss={() => {
            setSelectedCharger(null);
            setMarkerScreenCoords(null);
            setRouteCoords(null);
            setRouteDistanceMeters(null);
          }}
        />
      ) : null}

      <PermissionToast
        visible={showLocationToast}
        onDismiss={() => setShowLocationToast(false)}
        message="Necesitamos tu ubicación para mostrar cargadores cerca tuyo."
        ctaLabel="Activar"
        onCtaPress={() => {
          setShowLocationToast(false);
          void Linking.openSettings();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
