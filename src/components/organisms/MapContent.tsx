/**
 * MapContent — charger map surface.
 *
 * CRITICAL: All @rnmapbox/maps usage is via dynamic import() inside
 * useEffect. This prevents the "native code not available" crash
 * when the APK doesn't have the native module (Expo Go, stale build,
 * etc.). The component shows a fallback until the import succeeds.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

import { FAB } from '@/components/atoms/FAB';
import { Icon } from '@/components/atoms/Icon';
import { URUGUAY_FALLBACK } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';

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
  const [MapboxGL, setMapboxGL] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import('@rnmapbox/maps');
        if (cancelled) return;
        const gl = mod.default ?? mod;
        const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
        if (token && gl?.setAccessToken) {
          gl.setAccessToken(token);
        }
        setMapboxGL(() => gl);
        setReady(true);
      } catch {
        if (!cancelled) setReady(true); // ready but MapboxGL stays null → fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready || !MapboxGL) {
    return (
      <View style={[styles.root, styles.fallback]}>
        <Text style={styles.fallbackText}>
          {ready ? 'Mapa no disponible en este dispositivo' : 'Cargando mapa...'}
        </Text>
      </View>
    );
  }

  const MAPBOX_STYLE = MapboxGL.StyleURL?.Street ?? 'MapboxStandardStyleV8';

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
            <MapboxGL.SymbolLayer
              id="charger-cluster-count"
              filter={['has', 'point_count']}
              style={{
                textField: ['get', 'point_count_abbreviated'],
                textSize: 13,
                textColor: colors.textOnPrimary,
              }}
            />
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
  fallback: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  fallbackText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
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
