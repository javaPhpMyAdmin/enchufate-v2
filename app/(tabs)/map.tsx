/**
 * Mapa tab — public charger discovery surface (Phase 4).
 *
 * Renders a MapLibre view tiled from OpenFreeMap (no tokens required)
 * centered on Uruguay, with native clustering of charger pins.
 *
 * **Mount guard**: MapContent (which imports MapLibre's TurboModules)
 * is deferred via a `mounted` flag that flips in `useEffect`. This
 * gives the native bridge time to re-initialize after an OAuth
 * redirect callback, preventing the `MLRNCameraModule` invariant
 * violation.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
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
import type { PressEventWithFeatures } from '@maplibre/maplibre-react-native';

// ── Lazy import (deferred until first render tick) ───────────
// React.lazy is NOT sufficient on its own because Metro bundles
// everything into a single file. The actual fix is the `mounted`
// flag in useEffect below, which delays mounting MapContent until
// after the first render cycle completes.
const MapContent = React.lazy(
  () => import('@/components/organisms/MapContent'),
);

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
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Mount guard: defer MapContent until after the first render cycle.
  // This is critical for the post-OAuth redirect scenario where
  // TurboModules haven't re-registered yet.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
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
    cameraRef.current?.easeTo({
      center: [target.lng, target.lat],
      zoom: last ? 13 : URUGUAY_FALLBACK.zoom,
      duration: 600,
    });
  }, []);

  const handleSourcePress = useCallback(
    async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const feature = event.nativeEvent.features?.[0];
      if (!feature?.properties) return;
      const props = feature.properties as unknown as {
        cluster?: boolean;
        cluster_id?: number;
        id?: string;
      };
      if (props.cluster && typeof props.cluster_id === 'number' && sourceRef.current) {
        const expansionZoom = await sourceRef.current.getClusterExpansionZoom(props.cluster_id);
        cameraRef.current?.zoomTo(expansionZoom, { duration: 500 });
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

  // ── Mount guard: show nothing until the bridge is ready ───
  if (!mounted) {
    return <LoadingState label="Cargando mapa..." />;
  }

  // ── Main render ───────────────────────────────────────────
  return (
    <View style={styles.root}>
      <React.Suspense fallback={<LoadingState label="Cargando mapa..." />}>
        <MapContent
          geojson={geojson}
          onRecenter={handleRecenter}
          onSourcePress={handleSourcePress}
          insets={insets}
          onFilterPress={() => setSheetOpen(true)}
          cameraRef={cameraRef}
          sourceRef={sourceRef}
        />
      </React.Suspense>

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
