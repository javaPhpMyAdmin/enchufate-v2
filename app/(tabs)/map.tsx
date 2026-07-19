/**
 * Mapa tab — public charger discovery surface (Phase 4).
 *
 * Renders a MapLibre view tiled from OpenFreeMap (no tokens required)
 * centered on Uruguay, with native clustering of charger pins
 * (`cluster: true` on the GeoJSONSource, `clusterMaxZoom: 14`).
 * Below zoom 14 the user sees a bubble per cluster with the count;
 * at zoom >= 14 each charger is rendered as a `cargador.png` symbol.
 *
 * Tap behavior:
 *   - Cluster bubble → expand the cluster (animate camera to
 *     `getClusterExpansionZoom(clusterId)`).
 *   - Single charger pin → log the id to the console. The navigation
 *     to `/charger/[id]` lands in Phase 6; Expo Router will 404
 *     silently for now.
 *
 * The Filtros pill at the top opens the FiltersSheet bottom sheet
 * (5 chip-group sections). FAB anchored bottom-right recenters on
 * the user's location (Uruguay fallback when permission denied).
 *
 * OSM attribution is rendered as a fixed footer (OSM ToS requirement
 * — see `openspec/specs/map/spec.md` non-functional notes).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  Map as MapView,
  GeoJSONSource,
  Images,
  Layer,
  type CameraRef,
  type GeoJSONSourceRef,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { SlidersHorizontal } from 'lucide-react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChargers } from '@/features/chargers/hooks/useChargers';
import { useFilterStore } from '@/stores/filterStore';
import {
  URUGUAY_FALLBACK,
  getLastKnownPosition,
  requestLocationPermission,
} from '@/lib/location';
import { FAB } from '@/components/atoms/FAB';
import { Icon } from '@/components/atoms/Icon';
import { LoadingState } from '@/components/molecules/LoadingState';
import { ErrorState } from '@/components/molecules/ErrorState';
import { FiltersSheet } from '@/components/organisms/FiltersSheet';
import { colors, radius, spacing, typography } from '@/theme';
import type { Charger } from '@/features/chargers/types';

const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
const CARGADOR_ICON_ID = 'cargador';

const INITIAL_CAMERA = {
  center: [URUGUAY_FALLBACK.lng, URUGUAY_FALLBACK.lat] as [number, number],
  zoom: URUGUAY_FALLBACK.zoom,
} as const;

interface ChargerFeatureProps {
  id: string;
  title: string;
  connector_type: Charger['connector_type'];
  power_kw: number;
  status: Charger['status'];
  cluster?: boolean;
  cluster_id?: number;
  point_count?: number;
}

type ChargerFeature = Feature<Point, ChargerFeatureProps>;
type ChargerFC = FeatureCollection<Point, ChargerFeatureProps>;

function chargersToGeoJSON(chargers: Charger[]): ChargerFC {
  return {
    type: 'FeatureCollection',
    features: chargers.map(
      (c): ChargerFeature => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          id: c.id,
          title: c.title,
          connector_type: c.connector_type,
          power_kw: c.power_kw,
          status: c.status,
        },
      }),
    ),
  };
}

export default function MapTab() {
  const insets = useSafeAreaInsets();
  const filters = useFilterStore((s) => s.filters);
  const { data, isLoading, error, refetch } = useChargers(filters);
  const cameraRef = useRef<CameraRef>(null);
  const sourceRef = useRef<GeoJSONSourceRef>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Request location permission on first mount (Phase 4 spec).
  // A denied permission is non-fatal — the FAB falls back to Uruguay.
  useEffect(() => {
    requestLocationPermission().catch(() => {
      // Phase 8 will replace this with a toast. For now, console only.
      // eslint-disable-next-line no-console
      console.warn('[Mapa] Activá la ubicación para centrar el mapa');
    });
  }, []);

  const geojson = useMemo<ChargerFC | null>(
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

  // Tap on either a cluster bubble or an individual pin.
  // The MapLibre `onPress` source event exposes `features[]` with our
  // typed `ChargerFeatureProps` shape (we just built the FC). The
  // event is wrapped in a `NativeSyntheticEvent`; we unwrap it to
  // read `features`.
  const handleSourcePress = useCallback(
    async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const feature = event.nativeEvent.features?.[0];
      if (!feature?.properties) return;
      // The native side serializes properties as an unknown dict; we
      // typed the FC, so the cast is safe.
      const props = feature.properties as unknown as ChargerFeatureProps;
      if (props.cluster && typeof props.cluster_id === 'number' && sourceRef.current) {
        const expansionZoom = await sourceRef.current.getClusterExpansionZoom(props.cluster_id);
        // `zoomTo` animates to a new zoom level WITHOUT panning — the
        // cluster stays centered in the viewport as it expands.
        cameraRef.current?.zoomTo(expansionZoom, { duration: 500 });
        return;
      }
      if (props.id) {
        // Phase 6 will navigate to /charger/[id]. For now, log to console
        // so QA can verify the tap handler fires.
        // eslint-disable-next-line no-console
        console.log(`[Mapa] charger tapped: ${props.id} (${props.title ?? ''})`);
      }
    },
    [],
  );

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

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={OPENFREEMAP_LIBERTY}
        logo={false}
        attribution={false}
      >
        <Camera
          ref={cameraRef}
          initialViewState={INITIAL_CAMERA}
          center={INITIAL_CAMERA.center}
          zoom={INITIAL_CAMERA.zoom}
        />
        <Images
          images={{
            [CARGADOR_ICON_ID]: require('@/../assets/icons/cargador.png'),
          }}
        />
        {geojson ? (
          <GeoJSONSource
            ref={sourceRef}
            data={geojson}
            cluster
            clusterRadius={50}
            clusterMaxZoom={14}
            onPress={handleSourcePress}
          >
            {/* Cluster bubble (rendered at zoom < 14). */}
            <Layer
              id="charger-clusters"
              type="circle"
              filter={['has', 'point_count']}
              paint={{
                'circle-color': colors.primary,
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  18,
                  5,
                  24,
                  20,
                  30,
                ],
                'circle-stroke-width': 3,
                'circle-stroke-color': colors.surface,
              }}
            />
            {/* Cluster count (number inside the bubble). */}
            <Layer
              id="charger-cluster-count"
              type="symbol"
              filter={['has', 'point_count']}
              layout={{
                'text-field': ['get', 'point_count_abbreviated'],
                'text-size': 13,
                'text-font': ['Noto Sans Regular'],
              }}
              paint={{
                'text-color': colors.textOnPrimary,
              }}
            />
            {/* Individual charger pin (zoom >= 14). */}
            <Layer
              id="charger-pin"
              type="symbol"
              filter={['!', ['has', 'point_count']]}
              layout={{
                'icon-image': CARGADOR_ICON_ID,
                'icon-size': 0.15,
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </MapView>

      {/* Filtros pill — top-left, above the safe area. */}
      <View
        pointerEvents="box-none"
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
      >
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
          accessibilityRole="button"
          accessibilityLabel="Abrir filtros"
        >
          <Icon icon={SlidersHorizontal} size="sm" color={colors.textPrimary} />
          <Text style={styles.pillLabel}>Filtros</Text>
        </Pressable>
      </View>

      {/* OSM attribution (required by OpenStreetMap ToS). */}
      <View
        pointerEvents="none"
        style={[styles.attribution, { bottom: insets.bottom + spacing.xs }]}
      >
        <Text style={styles.attributionText}>
          © OpenFreeMap © OpenStreetMap contributors
        </Text>
      </View>

      {/* Recenter FAB — bottom-right. */}
      <FAB
        onPress={handleRecenter}
        accessibilityLabel="Centrar mapa en tu ubicación"
        style={{ bottom: insets.bottom + spacing.lg }}
      />

      <FiltersSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
  },
  pillPressed: { opacity: 0.85 },
  pillLabel: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  attribution: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    alignItems: 'center',
  },
  attributionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.button,
  },
});
