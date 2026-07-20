/**
 * MapContent — Mapbox-rendered charger map surface.
 *
 * Extracted from map.tsx and loaded via dynamic import() to avoid
 * TurboModule crashes when the native bridge isn't ready.
 *
 * This component owns all Mapbox imports and the static
 * `require()` for the cargador icon. The parent (map.tsx) creates
 * the refs and callbacks; they are passed in as props.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import type { NativeSyntheticEvent } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

import { FAB } from '@/components/atoms/FAB';
import { Icon } from '@/components/atoms/Icon';
import { URUGUAY_FALLBACK } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';

// ── Constants ────────────────────────────────────────────────
const MAPBOX_STYLE = MapboxGL.StyleURL.Street;
const CARGADOR_ICON_ID = 'cargador';

const INITIAL_CAMERA = {
  centerCoordinate: [URUGUAY_FALLBACK.lng, URUGUAY_FALLBACK.lat] as [number, number],
  zoomLevel: URUGUAY_FALLBACK.zoom,
} as const;

// ── GeoJSON type ─────────────────────────────────────────────
export type ChargerFC = import('geojson').FeatureCollection<import('geojson').Point>;

// ── Props ────────────────────────────────────────────────────
export interface MapContentProps {
  geojson: ChargerFC | null;
  onRecenter: () => void;
  onSourcePress: (event: any) => void;
  insets: { top: number; bottom: number };
  onFilterPress: () => void;
  cameraRef: React.RefObject<any>;
  sourceRef: React.RefObject<any>;
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
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={INITIAL_CAMERA.centerCoordinate}
          zoomLevel={INITIAL_CAMERA.zoomLevel}
          animationDuration={0}
        />
        <MapboxGL.Images
          images={{
            [CARGADOR_ICON_ID]: require('@/../assets/icons/cargador.png'),
          }}
        />
        {geojson ? (
          <MapboxGL.ShapeSource
            id="chargers"
            ref={sourceRef}
            shape={geojson}
            cluster
            clusterRadius={50}
            clusterMaxZoomLevel={14}
            onPress={onSourcePress}
          >
            {/* Cluster bubble (rendered at zoom < 14). */}
            <MapboxGL.CircleLayer
              id="charger-clusters"
              filter={['has', 'point_count']}
              style={{
                circleColor: colors.primary,
                circleRadius: [
                  'step',
                  ['get', 'point_count'],
                  18,
                  5,
                  24,
                  20,
                  30,
                ],
                circleStrokeWidth: 3,
                circleStrokeColor: colors.surface,
              }}
            />
            {/* Cluster count (number inside the bubble). */}
            <MapboxGL.SymbolLayer
              id="charger-cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 13,
                textColor: colors.textOnPrimary,
              }}
            />
            {/* Individual charger pin (zoom >= 14). */}
            <MapboxGL.SymbolLayer
              id="charger-pin"
              filter={['!', ['has', 'point_count']]}
              style={{
                iconImage: CARGADOR_ICON_ID,
                iconSize: 0.12,
                iconAnchor: 'bottom',
                iconAllowOverlap: true,
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}
      </MapboxGL.MapView>

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

      {/* Mapbox attribution (required by ToS). */}
      <View
        pointerEvents="none"
        style={[styles.attribution, { bottom: insets.bottom + spacing.xs }]}
      >
        <Text style={styles.attributionText}>
          © Mapbox © OpenStreetMap contributors
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
