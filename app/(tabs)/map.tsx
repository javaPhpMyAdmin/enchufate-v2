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
  getLastKnownPosition,
  requestLocationPermission,
} from '@/lib/location';
import { LoadingState } from '@/components/molecules/LoadingState';
import { ErrorState } from '@/components/molecules/ErrorState';
import { PermissionToast } from '@/components/molecules/PermissionToast';
import { FiltersSheet } from '@/components/organisms/FiltersSheet';
import { colors, spacing } from '@/theme';
import type { Charger } from '@/features/chargers/types';
import type { MapContentProps } from '@/components/organisms/MapContent';

// ── GeoJSON helpers (no MapLibre dependency) ─────────────────
type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Point>;

function chargersToGeoJSON(chargers: Charger[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: chargers.map((c): GeoJSONFeature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        id: c.id,
        title: c.title,
        connector_type: c.connector_type,
        power_kw: c.power_kw,
        status: c.status,
      },
    })),
  };
}

// ── Component ────────────────────────────────────────────────
export default function MapTab() {
  const insets = useSafeAreaInsets();
  const filters = useFilterStore((s) => s.filters);
  const { data, isLoading, error, refetch } = useChargers(filters);
  const cameraRef = useRef<any>(null);
  const sourceRef = useRef<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showLocationToast, setShowLocationToast] = useState(false);
  const router = useRouter();

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
    });
  }, []);

  const geojson = useMemo(
    () => (data ? chargersToGeoJSON(data) : null),
    [data],
  );

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
      const feature = event.nativeEvent.features?.[0];
      if (!feature?.properties) return;
      const props = feature.properties as Record<string, unknown> & {
        cluster?: boolean;
        cluster_id?: number;
        id?: string;
      };
      if (props.cluster && typeof props.cluster_id === 'number' && sourceRef.current) {
        const zoom = await sourceRef.current.getClusterExpansionZoom(props.cluster_id);
        cameraRef.current?.setCamera({
          zoomLevel: zoom,
          animationMode: 'easeTo',
          animationDuration: 500,
        });
        return;
      }
      if (props.id) {
        router.push(`/charger/${props.id}` as never);
      }
    },
    [router],
  );

  // ── Loading / error states ────────────────────────────────
  if (isLoading) {
    return <LoadingState label="Cargando cargadores..." />;
  }
  if (error) {
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
        onRecenter={handleRecenter}
        onSourcePress={handleSourcePress}
        insets={insets}
        onFilterPress={() => setSheetOpen(true)}
        cameraRef={cameraRef}
        sourceRef={sourceRef}
      />

      <FiltersSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />

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
