/**
 * MapContent — Mapbox-rendered charger map surface.
 *
 * Loaded via dynamic import() from map.tsx. The parent catches
 * the load error and shows a fallback when the native module
 * is unavailable.
 *
 * This file uses a STATIC import of @rnmapbox/maps because nested
 * dynamic imports (map.tsx → MapContent → @rnmapbox/maps) cause
 * Metro "unknown module" errors.
 */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
// import type { NativeSyntheticEvent } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

import { FAB } from '@/components/atoms/FAB';
import { Icon } from '@/components/atoms/Icon';
import { URUGUAY_FALLBACK } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';
import Mapbox from '@rnmapbox/maps';

// ── Constants ────────────────────────────────────────────────
const MAPBOX_STYLE = MapboxGL.StyleURL.Street;
const CARGADOR_ICON_ID = 'cargador';

// Inicializa el token público (el que empieza con pk.)
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');

const INITIAL_CAMERA = {
  centerCoordinate: [URUGUAY_FALLBACK.lng, URUGUAY_FALLBACK.lat] as [
    number,
    number,
  ],
  zoomLevel: URUGUAY_FALLBACK.zoom,
} as const;

// ── GeoJSON type ─────────────────────────────────────────────
export type ChargerFC = import('geojson').FeatureCollection<
  import('geojson').Point
>;

// ── Props ────────────────────────────────────────────────────
export interface MapContentProps {
  geojson: ChargerFC | null;
  routeCoords?: [number, number][] | null;
  selectedChargerCoord?: [number, number] | null; // [lng, lat] for repositioning after fitBounds
  onRecenter: () => void;
  onSourcePress: (event: any) => void;
  onMarkerScreenCoords?: (coords: { x: number; y: number } | null) => void;
  insets: { top: number; bottom: number };
  onFilterPress: () => void;
  cameraRef: React.RefObject<any>;
  sourceRef: React.RefObject<any>;
  isRefreshing?: boolean;
}

// ── Component ────────────────────────────────────────────────
export default function MapContent({
  geojson,
  routeCoords,
  selectedChargerCoord,
  onRecenter,
  onSourcePress,
  onMarkerScreenCoords,
  insets,
  onFilterPress,
  cameraRef,
  sourceRef,
  isRefreshing = false,
}: MapContentProps) {
  const mapViewRef = useRef<MapboxGL.MapView>(null);
  const barWidth = useRef(new Animated.Value(0)).current;

  // Stable empty shape — never changes, so the ShapeSource never unmounts.
  const EMPTY_FEATURE: GeoJSON.Feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [0, 0] },
  };

  // Memoize route GeoJSON — only changes when routeCoords actually changes.
  const routeGeoJSON = useMemo(() => {
    if (!routeCoords || routeCoords.length < 2) return EMPTY_FEATURE;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routeCoords,
      },
    };
  }, [routeCoords]);

  // Fit camera to route bounds + reposition card after animation.
  useEffect(() => {
    if (!routeCoords || routeCoords.length < 2 || !cameraRef.current) return;
    const lngs = routeCoords.map((c) => c[0]);
    const lats = routeCoords.map((c) => c[1]);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];

    // Ensure a minimum bounds size so short routes don't zoom in too tight.
    const MIN_DEG = 0.006; // ~660 m — enough headroom for nearby chargers
    const lngSpan = ne[0] - sw[0];
    const latSpan = ne[1] - sw[1];
    if (lngSpan < MIN_DEG) {
      const pad = (MIN_DEG - lngSpan) / 2;
      sw[0] -= pad;
      ne[0] += pad;
    }
    if (latSpan < MIN_DEG) {
      const pad = (MIN_DEG - latSpan) / 2;
      sw[1] -= pad;
      ne[1] += pad;
    }

    cameraRef.current.setCamera({
      bounds: { ne, sw, padding: 60 },
      animationMode: 'easeTo',
      animationDuration: 600,
    });

    // After zoom animation, recalculate marker screen position so the card
    // stays above the marker at its new screen location.
    if (selectedChargerCoord && onMarkerScreenCoords && mapViewRef.current) {
      const timer = setTimeout(() => {
        mapViewRef.current
          ?.getPointInView(selectedChargerCoord)
          .then((point: number[] | null) => {
            if (point && point[0] != null && point[1] != null) {
              onMarkerScreenCoords({ x: point[0], y: point[1] });
            }
          });
      }, 650); // slightly after animation completes
      return () => clearTimeout(timer);
    }
  }, [routeCoords, cameraRef, selectedChargerCoord, onMarkerScreenCoords]);

  useEffect(() => {
    if (isRefreshing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(barWidth, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(barWidth, {
            toValue: 0,
            duration: 400,
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      barWidth.setValue(0);
    }
  }, [isRefreshing, barWidth]);

  // Convert marker coords → screen position for the popup card.
  const handleShapePress = useCallback(
    async (event: any) => {
      const feature = event.features?.[0] ?? event.nativeEvent?.features?.[0];
      const coords = feature?.geometry?.coordinates as
        | [number, number]
        | undefined;
      if (coords && onMarkerScreenCoords && mapViewRef.current) {
        const point = await mapViewRef.current.getPointInView(coords);
        if (point) {
          onMarkerScreenCoords({ x: point[0], y: point[1] });
        }
      } else if (onMarkerScreenCoords) {
        onMarkerScreenCoords(null);
      }
      onSourcePress(event);
    },
    [onSourcePress, onMarkerScreenCoords],
  );

  return (
    <View style={styles.root}>
      <MapboxGL.MapView
        ref={mapViewRef}
        style={StyleSheet.absoluteFill}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          centerCoordinate={INITIAL_CAMERA.centerCoordinate}
          zoomLevel={INITIAL_CAMERA.zoomLevel}
          animationDuration={0}
          padding={{
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: 0,
            paddingRight: 0,
          }}
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
            clusterRadius={30}
            clusterMaxZoomLevel={20}
            onPress={handleShapePress}
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
            {/* Individual P2P charger pin (zoom >= 14, source=enchufate). */}
            <MapboxGL.SymbolLayer
              id="charger-pin"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'enchufate'],
              ]}
              style={{
                iconImage: CARGADOR_ICON_ID,
                iconSize: 0.16,
                iconAnchor: 'bottom',
                iconAllowOverlap: true,
              }}
            />
            {/* Individual UTE charger pin — blue circle + "UTE" text (source=ute). */}
            <MapboxGL.CircleLayer
              id="ute-pin-bg"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'ute'],
              ]}
              style={{
                circleColor: colors.ute,
                circleRadius: 16,
                circleStrokeWidth: 2,
                circleStrokeColor: colors.surface,
              }}
            />
            <MapboxGL.SymbolLayer
              id="ute-pin"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'ute'],
              ]}
              style={{
                textField: 'UTE',
                textSize: 10,
                textColor: colors.textOnPrimary,
                textFont: [
                  'DIN Offc Pro Bold',
                  'Open Sans Bold',
                  'Arial Unicode MS Bold',
                ],
                textAllowOverlap: true,
              }}
            />
            {/* Individual OCM charger pin — blue circle + "OCM" text (source=ocm). */}
            <MapboxGL.CircleLayer
              id="ocm-pin-bg"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'ocm'],
              ]}
              style={{
                circleColor: colors.ute,
                circleRadius: 16,
                circleStrokeWidth: 2,
                circleStrokeColor: colors.surface,
              }}
            />
            <MapboxGL.SymbolLayer
              id="ocm-pin"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'ocm'],
              ]}
              style={{
                textField: 'OCM',
                textSize: 10,
                textColor: colors.textOnPrimary,
                textFont: [
                  'DIN Offc Pro Bold',
                  'Open Sans Bold',
                  'Arial Unicode MS Bold',
                ],
                textAllowOverlap: true,
              }}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {/* Route polyline (OSRM) — always mounted to prevent flicker on zoom. */}
        <MapboxGL.ShapeSource id="route-source" shape={routeGeoJSON}>
          <MapboxGL.LineLayer
            id="route-line"
            style={{
              lineColor: 'black',
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
              lineOpacity: routeCoords && routeCoords.length > 1 ? 1 : 0,
            }}
          />
        </MapboxGL.ShapeSource>
        <Mapbox.UserLocation
          animated={true}
          androidRenderMode={'gps'}
          visible={true}
          showsUserHeadingIndicator={true}
        />
      </MapboxGL.MapView>

      {/* Loading bar — thin animated indicator during filter refreshes. */}
      {isRefreshing ? (
        <View style={[styles.loadingBarTrack, { top: insets.top }]}>
          <Animated.View
            style={[
              styles.loadingBarFill,
              {
                width: barWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      ) : null}

      {/* Filtros pill — top-left, above the safe area. */}
      <Pressable
        onPress={onFilterPress}
        style={({ pressed }) => [
          styles.pill,
          {
            position: 'absolute',
            top: insets.top + spacing.sm,
            left: spacing.lg,
          },
          pressed && styles.pillPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Abrir filtros"
        hitSlop={8}
      >
        <Icon icon={SlidersHorizontal} size="sm" color={colors.textOnPrimary} />
        <Text style={styles.pillLabel}>Filtros</Text>
      </Pressable>

      {/* Mapbox attribution (required by ToS). */}
      <View
        pointerEvents="none"
        style={[styles.attribution, { bottom: insets.bottom + spacing.xs }]}
      >
        {/* <Text style={styles.attributionText}>
          © Mapbox © OpenStreetMap contributors
        </Text> */}
      </View>

      {/* Recenter FAB — bottom-right. */}
      <Mapbox.UserLocation
        animated={true}
        androidRenderMode={'gps'}
        visible={true}
        showsUserHeadingIndicator={true}
      />
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
    zIndex: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    elevation: 4,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minHeight: 40,
  },
  pillPressed: { opacity: 0.85 },
  pillLabel: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
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
  loadingBarTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    zIndex: 20,
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 1.5,
  },
});
