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
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { SlidersHorizontal } from 'lucide-react-native';

import { FAB } from '@/components/atoms/FAB';
import { Icon } from '@/components/atoms/Icon';
import { ChargerCallout } from '@/components/organisms/ChargerCallout';
import { URUGUAY_FALLBACK } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';
import Mapbox from '@rnmapbox/maps';

// ── Constants ────────────────────────────────────────────────
const MAPBOX_STYLE = MapboxGL.StyleURL.Street;
const CARGADOR_ICON_ID = 'cargador';

// Charging pulse halo — ring that expands + fades around charging pins.
const PULSE_RING_SIZE = 44;
const PULSE_RING_BORDER = 3;
const PULSE_DURATION_MS = 1400;
const PULSE_SCALE_MIN = 0.5;
const PULSE_SCALE_MAX = 1.8;
const PULSE_OPACITY_MAX = 0.5;

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
  geojson: GeoJSON.FeatureCollection | null;
  routeCoords?: [number, number][] | null;
  /** Full selected-charger object — used to render the MarkerView callout. */
  selectedCharger?: {
    id: string;
    title: string;
    lat: number;
    lng: number;
  } | null;
  onRecenter: () => void;
  onSourcePress: (event: any) => void;
  insets: EdgeInsets;
  onFilterPress: () => void;
  /** Fires when the floating callout badge is tapped. */
  onCalloutPress: () => void;
  /** Fires when the map background is tapped (not on a pin). */
  onMapPress?: () => void;
  cameraRef: React.RefObject<any>;
  sourceRef: React.RefObject<any>;
  isRefreshing?: boolean;
  routeLoading?: boolean;
  /** Hide UI overlays that compete with the bottom sheet. */
  sheetOpen?: boolean;
}

// ── Component ────────────────────────────────────────────────
export default function MapContent({
  geojson,
  routeCoords,
  selectedCharger,
  onRecenter,
  onSourcePress,
  insets,
  onFilterPress,
  onCalloutPress,
  onMapPress,
  cameraRef,
  sourceRef,
  isRefreshing = false,
  routeLoading = false,
  sheetOpen = false,
}: MapContentProps) {
  const mapViewRef = useRef<MapboxGL.MapView>(null);
  const barWidth = useRef(new Animated.Value(0)).current;

  // ── Selected-charger bounce animation (≈3s cycle) ─────────
  // Tied to selectedCharger so it properly resets on mount/unmount.
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!selectedCharger) return;

    bounceAnim.setValue(0);
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    bounce.start();
    return () => bounce.stop();
  }, [selectedCharger]);

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

  // Actively-charging P2P pins (source=enchufate with current_charging_since
  // set). Keyed on geojson so a Realtime update that clears the field drops
  // the feature here and its pulse MarkerView unmounts naturally.
  const chargingPins = useMemo(() => {
    if (!geojson) return [];
    const pins: { id: string; lat: number; lng: number }[] = [];
    for (const f of geojson.features) {
      const props = f.properties;
      if (props?.source !== 'enchufate') continue;
      if (!props.current_charging_since) continue;
      const id = typeof props.id === 'string' ? props.id : '';
      if (!id) continue;
      const coords = f.geometry.type === 'Point' ? f.geometry.coordinates : null;
      const lat = typeof props.lat === 'number' ? props.lat : coords?.[1];
      const lng = typeof props.lng === 'number' ? props.lng : coords?.[0];
      if (lat == null || lng == null) continue;
      pins.push({ id, lat, lng });
    }
    return pins;
  }, [geojson]);

  // Fit camera to route bounds.
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
      bounds: { ne, sw },
      padding: {
        paddingTop: 100,
        paddingBottom: insets.bottom + 160,
        paddingLeft: 100,
        paddingRight: 100,
      },
      animationMode: 'easeTo',
      animationDuration: 600,
    });
  }, [routeCoords, cameraRef]);

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

  const handleShapePress = useCallback(
    async (event: any) => {
      onSourcePress(event);
    },
    [onSourcePress],
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
        onPress={onMapPress}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={INITIAL_CAMERA}
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
            {/* Individual P2P charger pin (zoom >= 14, source=enchufate).
                Excludes chargers with an active charging session —
                those get their own orange layer below. */}
            <MapboxGL.SymbolLayer
              id="charger-pin"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'enchufate'],
                ['!', ['has', 'current_charging_since']],
              ]}
              style={{
                iconImage: CARGADOR_ICON_ID,
                iconSize: 0.16,
                iconAnchor: 'bottom',
                iconAllowOverlap: true,
              }}
            />
            {/* Orange charging pin (source=enchufate, actively charging). */}
            <MapboxGL.CircleLayer
              id="charger-pin-charging-bg"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'enchufate'],
                ['has', 'current_charging_since'],
              ]}
              style={{
                circleColor: colors.charging,
                circleRadius: 16,
                circleStrokeWidth: 2,
                circleStrokeColor: colors.surface,
              }}
            />
            <MapboxGL.SymbolLayer
              id="charger-pin-charging"
              filter={[
                'all',
                ['!', ['has', 'point_count']],
                ['==', 'source', 'enchufate'],
                ['has', 'current_charging_since'],
              ]}
              style={{
                textField: '⚡',
                textSize: 16,
                textAllowOverlap: true,
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

        {/* Callout badge anchored to the selected charger pin.
            MarkerView moves naturally with the map — no gesture hacks needed. */}
        {selectedCharger && (
          <MapboxGL.MarkerView
            coordinate={[selectedCharger.lng, selectedCharger.lat]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <Animated.View
              style={[
                styles.selectedMarkerContainer,
                { transform: [{ translateY: bounceAnim }] },
              ]}
            >
              <ChargerCallout title="Ver" onPress={onCalloutPress} />
              <Image
                source={require('@/../assets/icons/plug.png')}
                style={[styles.selectedPlugImage, { marginTop: -10 }]}
                resizeMode="contain"
              />
            </Animated.View>
          </MapboxGL.MarkerView>
        )}

        {/* Live pulse halo on actively-charging pins — one MarkerView per
            pin, centered (anchor 0.5/0.5) so the ring grows around the
            orange CircleLayer pin. Static pin layers above stay untouched. */}
        {chargingPins.length > 0 &&
          chargingPins.map((pin) => (
            <MapboxGL.MarkerView
              key={pin.id}
              coordinate={[pin.lng, pin.lat]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <ChargingPulse />
            </MapboxGL.MarkerView>
          ))}

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

      {/* Route loading indicator — centered on screen while OSRM fetches. */}
      {routeLoading && (
        <View style={[styles.routePill, { top: '40%' }]} pointerEvents="none">
          <ActivityIndicator size={20} color={colors.primary} />
          <Text style={styles.routePillText}>Calculando ruta...</Text>
        </View>
      )}

      {/* Recenter FAB — hidden while bottom sheet is open. */}
      {!sheetOpen && (
        <FAB
          onPress={onRecenter}
          accessibilityLabel="Centrar mapa en tu ubicación"
          style={{ bottom: insets.bottom + spacing.lg + 64 }}
        />
      )}
    </View>
  );
}

// ── ChargingPulse ────────────────────────────────────────────
// Expanding + fading halo ring around an actively-charging pin.
// Visual only: pointerEvents="none" so pin touches still reach the
// ShapeSource onPress handler underneath the MarkerView.
function ChargingPulse() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: PULSE_DURATION_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [PULSE_SCALE_MIN, PULSE_SCALE_MAX],
              }),
            },
          ],
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [PULSE_OPACITY_MAX, 0],
          }),
        },
      ]}
    />
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
  selectedMarkerContainer: {
    alignItems: 'center',
  },
  pulseRing: {
    width: PULSE_RING_SIZE,
    height: PULSE_RING_SIZE,
    borderRadius: PULSE_RING_SIZE / 2,
    borderWidth: PULSE_RING_BORDER,
    borderColor: colors.charging,
    backgroundColor: 'transparent',
  },
  selectedPlugImage: {
    width: 65,
    height: 65,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  routePill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  routePillText: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
