/**
 * ChargerMapSnippet — small MapLibre preview used in charger detail.
 *
 * Extracted and lazy-loaded from [id].tsx to avoid the
 * `MLRNCameraModule` TurboModule crash on post-OAuth redirect.
 * Mount guard (parent controls rendering) ensures the native bridge
 * is ready before MapLibre components mount.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera as MapCamera,
  Map as MapView,
  GeoJSONSource,
  Images,
  Layer,
} from '@maplibre/maplibre-react-native';
import { ArrowUpRight } from 'lucide-react-native';

import { Icon } from '@/components/atoms/Icon';
import { colors, radius, spacing, typography } from '@/theme';

const OPENFREEMAP_LIBERTY = 'https://tiles.openfreemap.org/styles/liberty';
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
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={OPENFREEMAP_LIBERTY}
        logo={false}
        attribution={false}
        pointerEvents="none"
      >
        <MapCamera center={[lng, lat]} zoom={14} />
        <Images images={{ [CARGADOR_SNIPPET_ICON]: require('@/../assets/icons/cargador.png') }} />
        <GeoJSONSource data={geojson}>
          <Layer
            id="snippet-pin"
            type="symbol"
            layout={{
              'icon-image': CARGADOR_SNIPPET_ICON,
              'icon-size': 0.12,
              'icon-anchor': 'bottom',
              'icon-allow-overlap': true,
            }}
          />
        </GeoJSONSource>
      </MapView>
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
