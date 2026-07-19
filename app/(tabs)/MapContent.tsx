/**
 * MapContent — MapLibre-rendered charger map surface.
 *
 * Extracted from map.tsx and lazy-loaded to avoid the TurboModule
 * race condition where `MLRNCameraModule` is not yet available when
 * the app returns from Google OAuth. `React.lazy` defers the native
 * module resolution to after the first render cycle.
 *
 * This component owns all MapLibre imports and the static
 * `require()` for the cargador icon. The parent (map.tsx) creates
 * the refs and callbacks; they are passed in as props.
 */
import React from 'react';
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
import type { NativeSyntheticEvent } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

import { FAB } from '@/components/atoms/FAB';
import { Icon } from '@/components/atoms/Icon';
import { URUGUAY_FALLBACK } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';

// ── Constants ────────────────────────────────────────────────
const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
const CARGADOR_ICON_ID = 'cargador';

const INITIAL_CAMERA = {
  center: [URUGUAY_FALLBACK.lng, URUGUAY_FALLBACK.lat] as [number, number],
  zoom: URUGUAY_FALLBACK.zoom,
} as const;

// ── Public types (re-exported for parent) ────────────────────
export type { CameraRef, GeoJSONSourceRef, PressEventWithFeatures };

// ── GeoJSON helper ───────────────────────────────────────────
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Charger } from '@/features/chargers/types';

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
export type ChargerFC = FeatureCollection<Point, ChargerFeatureProps>;

export function chargersToGeoJSON(chargers: Charger[]): ChargerFC {
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

// ── Props ────────────────────────────────────────────────────
export interface MapContentProps {
  geojson: ChargerFC | null;
  onRecenter: () => void;
  onSourcePress: (event: NativeSyntheticEvent<PressEventWithFeatures>) => void;
  insets: { top: number; bottom: number };
  onFilterPress: () => void;
  cameraRef: React.RefObject<CameraRef | null>;
  sourceRef: React.RefObject<GeoJSONSourceRef | null>;
}

// ── Component ────────────────────────────────────────────────
export default function MapContent({
  geojson,
  onRecenter,
  onSourcePress,
  insets,
  onFilterPress,
  cameraRef,
  sourceRef,
}: MapContentProps) {
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
            onPress={onSourcePress}
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
                'icon-size': 0.12,
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
          onPress={onFilterPress}
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
        onPress={onRecenter}
        accessibilityLabel="Centrar mapa en tu ubicación"
        style={{ bottom: insets.bottom + spacing.lg }}
      />
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
