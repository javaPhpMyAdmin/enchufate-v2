/**
 * ChargerMapSnippet — small Mapbox preview used in charger detail.
 *
 * Extracted and loaded via dynamic import from [id].tsx to avoid
 * TurboModule crash on post-OAuth redirect.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { ArrowUpRight } from 'lucide-react-native';

import { Icon } from '@/components/atoms/Icon';
import { colors, radius, spacing, typography } from '@/theme';

const MAPBOX_STYLE = MapboxGL.StyleURL.Street;
const CARGADOR_SNIPPET_ICON = 'cargador-snippet';

interface Props {
  lng: number;
  lat: number;
  id: string;
  onPress: () => void;
}

export default function ChargerMapSnippet({ lng, lat, id, onPress }: Props) {
  const geojson = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        properties: { id },
      },
    ],
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel="Ver en el mapa"
      style={styles.mapWrap}
    >
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MAPBOX_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        pointerEvents="none"
      >
        <MapboxGL.Camera
          centerCoordinate={[lng, lat]}
          zoomLevel={14}
          animationDuration={0}
        />
        <MapboxGL.Images
          images={{ [CARGADOR_SNIPPET_ICON]: require('@/../assets/icons/cargador.png') }}
        />
        <MapboxGL.ShapeSource id="snippet-source" shape={geojson}>
          <MapboxGL.SymbolLayer
            id="snippet-pin"
            style={{
              iconImage: CARGADOR_SNIPPET_ICON,
              iconSize: 0.12,
              iconAnchor: 'bottom',
              iconAllowOverlap: true,
            }}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
      <View style={styles.mapOverlay} pointerEvents="none">
        <Text style={styles.mapOverlayText}>Ver en Google Maps</Text>
        <Icon icon={ArrowUpRight} size="sm" color={colors.textOnPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 160,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  mapOverlayText: { ...typography.caption, color: colors.textOnPrimary, fontWeight: '600' },
});
