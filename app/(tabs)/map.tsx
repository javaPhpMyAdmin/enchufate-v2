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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { InteractionManager, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { ChargerBottomSheet } from '@/components/organisms/ChargerBottomSheet';
import { colors } from '@/theme';

import type {
  ChargerSource,
  ConnectorInfo,
  ConnectorType,
  Currency,
  MapCharger,
} from '@/features/chargers/types';
import type { MapContentProps } from '@/components/organisms/MapContent';

// ── OSRM polyline routing (free, no API key) ─────────────
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

interface OSRMRoute {
  coords: [number, number][]; // [lng, lat] pairs
  distanceMeters: number;
  duration: number;
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
    console.log('[fetchRoute] OSRM RESULT:', JSON.stringify(json, null, 2));
    const route = json.routes?.[0];
    if (!route) return null;
    return {
      coords: route.geometry?.coordinates ?? [],
      distanceMeters: route.distance ?? 0,
      duration: route.duration ?? 0,
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
  /** ISO 8601 — set when this P2P charger has an active charging session. */
  current_charging_since?: string;
}

// ── GeoJSON helpers (no MapLibre dependency) ─────────────────
type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Point>;

function chargersToGeoJSON(
  chargers: MapCharger[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: chargers.map(
      (c): GeoJSONFeature => ({
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
          current_charging_since: c.current_charging_since,
        },
      }),
    ),
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
  const [selectedCharger, setSelectedCharger] =
    useState<SelectedCharger | null>(null);
  const [showChargerSheet, setShowChargerSheet] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(
    null,
  );
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(
    null,
  );
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showLocationToast, setShowLocationToast] = useState(false);
  const router = useRouter();

  // Tracks whether the map tab is the active tab. expo-router does not
  // re-export useIsFocused, so we derive it from useFocusEffect. The
  // render gate below unmounts the native MapView while hidden (see
  // the `!isFocused` check in the main render).
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  // Cache user position — one GPS fix per session, reused for all route calculations.
  const userPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Track selected id across renders so handleSourcePress can detect same-pin taps.
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedCharger?.id ?? null;

  // Dynamic import state: we control WHEN MapContent is loaded.
  const [MapComponent, setMapComponent] =
    useState<React.ComponentType<MapContentProps> | null>(null);
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

  // Fly to user location every time the map tab gains focus.
  // Retries with backoff until the camera is ready (dynamic import delay).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const fly = async () => {
        const last = await getLastKnownPosition();
        const target = last ?? (await getCurrentPosition());
        if (!target || cancelled) return;

        const tryCamera = (attempts = 0) => {
          if (cancelled) return;
          if (cameraRef.current) {
            cameraRef.current.setCamera({
              centerCoordinate: [target.lng, target.lat],
              zoomLevel: last ? 13 : 11,
              animationMode: 'easeTo',
              animationDuration: 800,
            });
          } else if (attempts < 15) {
            setTimeout(() => tryCamera(attempts + 1), 200);
          }
        };
        tryCamera();
      };

      fly();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const geojson = useMemo(() => {
    if (!data) return null;
    // Exclude selected charger from clustering so it doesn't get
    // hidden inside a cluster bubble — the MarkerView handles it.
    const filtered = selectedCharger
      ? data.filter((c) => c.id !== selectedCharger.id)
      : data;
    return chargersToGeoJSON(filtered);
  }, [data, selectedCharger]);

  // Fetch OSRM route when a charger is selected.
  useEffect(() => {
    if (!selectedCharger) return; // Keep existing route visible when popup dismisses.

    let cancelled = false;
    setRouteLoading(true);

    const getFrom = async (): Promise<{ lat: number; lng: number }> => {
      if (userPositionRef.current) return userPositionRef.current;
      const pos = await getCurrentPosition();
      const from = pos ?? {
        lat: URUGUAY_FALLBACK.lat,
        lng: URUGUAY_FALLBACK.lng,
      };
      if (pos) userPositionRef.current = pos; // cache for next tap
      return from;
    };

    getFrom().then(async (from) => {
      if (cancelled) return;
      const route = await fetchRoute(
        from.lat,
        from.lng,
        selectedCharger.lat,
        selectedCharger.lng,
      );
      if (!cancelled) {
        if (route) {
          setRouteCoords(route.coords);
          setRouteDistanceMeters(route.distanceMeters);
          setRouteDuration(route.duration);
        }
        setRouteLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCharger?.id, selectedCharger]);

  const handleRecenter = useCallback(async () => {
    const last = await getLastKnownPosition();
    const target = last ?? {
      lat: URUGUAY_FALLBACK.lat,
      lng: URUGUAY_FALLBACK.lng,
    };
    cameraRef.current?.setCamera({
      centerCoordinate: [target.lng, target.lat],
      zoomLevel: last ? 13 : URUGUAY_FALLBACK.zoom,
      animationMode: 'easeTo',
      animationDuration: 600,
    });
    // Clear route and selection when recentering.
    setSelectedCharger(null);
    setRouteCoords(null);
    setRouteDistanceMeters(null);
    setRouteLoading(false);
    setShowChargerSheet(false);
  }, []);

  const handleSourcePress = useCallback(async (event: any) => {
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
      current_charging_since?: string;
    };
    if (
      props.cluster &&
      typeof props.cluster_id === 'number' &&
      sourceRef.current
    ) {
      const coords = feature.geometry?.coordinates as
        | [number, number]
        | undefined;
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
      // Same pin tapped again → dismiss everything
      if (props.id === selectedIdRef.current) {
        setSelectedCharger(null);
        setShowChargerSheet(false);
        setRouteCoords(null);
        setRouteDistanceMeters(null);
        setRouteLoading(false);
        return;
      }
      const connectors = props.connectors ?? [];
      setRouteCoords(null);
      setRouteDistanceMeters(null);
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
        current_charging_since: props.current_charging_since,
      });
      // Keep routeLoading as true while OSRM fetches — MapContent
      // will show a loading pill on the map itself.
      setRouteLoading(true);
    }
  }, []);

  const handleCalloutPress = useCallback(() => {
    setShowChargerSheet(true);
  }, []);

  const handleChargerDetail = useCallback(() => {
    if (!selectedCharger) return;
    const id = selectedCharger.id;
    setSelectedCharger(null);
    setShowChargerSheet(false);
    setRouteCoords(null);
    setRouteDistanceMeters(null);
    router.push(`/charger/${id}` as never);
  }, [selectedCharger, router]);

  const handleChargerDismiss = useCallback(() => {
    setShowChargerSheet(false);
  }, []);

  const handleMapPress = useCallback(() => {
    // Solo oculta el callout — la ruta se mantiene visible
    setShowChargerSheet(false);
  }, []);

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

  // ── Tab not focused — unmount the native MapView ─────────
  // NativeTabs keeps this screen mounted but hidden while the
  // user is on another tab; the native controller detaches the
  // MapView's tag, and @rnmapbox/maps' setHandledMapChangedEvents
  // retries against the stale tag for ~10s then rejects as an
  // unhandled promise. Unmounting here releases the native view
  // (remount on focus is acceptable) and the useFocusEffect camera
  // animation below re-runs once the map is mounted again.
  if (!isFocused) {
    return <View style={styles.root} />;
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <View style={styles.root}>
      <MapComponent
        geojson={geojson}
        routeCoords={routeCoords}
        selectedCharger={selectedCharger}
        onRecenter={handleRecenter}
        onSourcePress={handleSourcePress}
        insets={insets}
        onFilterPress={() => setSheetOpen(true)}
        onCalloutPress={handleCalloutPress}
        onMapPress={handleMapPress}
        cameraRef={cameraRef}
        sourceRef={sourceRef}
        isRefreshing={isPlaceholderData}
        routeLoading={routeLoading}
        sheetOpen={showChargerSheet}
      />

      <FiltersSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />

      <ChargerBottomSheet
        visible={showChargerSheet}
        title={selectedCharger?.title ?? ''}
        source={selectedCharger?.source ?? 'enchufate'}
        connectors={selectedCharger?.connectors ?? []}
        pricePerHour={selectedCharger?.pricePerHour ?? 0}
        currency={selectedCharger?.currency ?? 'USD'}
        lat={selectedCharger?.lat ?? 0}
        lng={selectedCharger?.lng ?? 0}
        routeDistanceMeters={routeDistanceMeters}
        routeDuration={routeDuration}
        stationStatus={selectedCharger?.stationStatus}
        charging_since={selectedCharger?.current_charging_since}
        onPressDetail={handleChargerDetail}
        onDismiss={handleChargerDismiss}
      />

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
