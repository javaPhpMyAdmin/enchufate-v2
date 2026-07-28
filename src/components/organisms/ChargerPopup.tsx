/**
 * ChargerPopup — compact floating card shown when a charger marker is tapped.
 *
 * Positioned above the marker using screen coordinates from
 * MapContent.getPointInView. Uses onLayout for precise height.
 *
 * Distance is fetched by the parent (map.tsx) via OSRM and passed
 * as routeDistanceMeters.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

import { CONNECTOR_LABEL, type ChargerSource, type ConnectorInfo, type ConnectorType, type Currency } from '@/features/chargers/types';
import { URUGUAY_FALLBACK } from '@/lib/location';
import { getCurrentPosition } from '@/lib/location';
import { formatPrice } from '@/lib/format';
import { colors, radius, shadows, spacing, typography } from '@/theme';

export interface ChargerPopupProps {
  title: string;
  source: ChargerSource;
  connectors: ConnectorInfo[];
  connectorType: ConnectorType;
  powerKw: number;
  pricePerHour: number;
  currency: Currency;
  lat: number;
  lng: number;
  position?: { x: number; y: number } | null;
  routeDistanceMeters?: number | null;
  onPressDetail: () => void;
  onDismiss: () => void;
}

const CARD_WIDTH = 230;
const ARROW_OFFSET = 10; // small gap between marker and card

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

/** Haversine fallback when OSRM is unavailable. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ChargerPopup({
  title,
  source,
  connectors,
  connectorType,
  powerKw,
  pricePerHour,
  currency,
  lat,
  lng,
  position,
  routeDistanceMeters,
  onPressDetail,
  onDismiss,
}: ChargerPopupProps) {
  const [fallbackDistance, setFallbackDistance] = useState<number | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(routeDistanceMeters == null);
  const [cardHeight, setCardHeight] = useState(0);

  // Haversine fallback if parent didn't provide OSRM distance.
  useEffect(() => {
    if (routeDistanceMeters != null) {
      setLoadingFallback(false);
      return;
    }
    let mounted = true;
    getCurrentPosition().then((pos) => {
      if (!mounted) return;
      const userLat = pos?.lat ?? URUGUAY_FALLBACK.lat;
      const userLng = pos?.lng ?? URUGUAY_FALLBACK.lng;
      setFallbackDistance(haversineMeters(userLat, userLng, lat, lng));
      setLoadingFallback(false);
    });
    return () => { mounted = false; };
  }, [routeDistanceMeters, lat, lng]);

  const displayDistance = routeDistanceMeters ?? fallbackDistance;
  const showLoading = loadingFallback && displayDistance == null;

  const handleBackdropPress = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const handleCardLayout = useCallback((e: LayoutChangeEvent) => {
    setCardHeight(e.nativeEvent.layout.height);
  }, []);

  // ── Positioning: always above the marker, centered ──
  const hasCoords = position != null;
  const cardLeft = hasCoords
    ? Math.max(8, Math.min(position.x - CARD_WIDTH / 2, SCREEN_WIDTH - CARD_WIDTH - 8))
    : spacing.md;
  const cardTop = hasCoords
    ? Math.max(8, position.y - cardHeight - ARROW_OFFSET)
    : undefined;
  const cardBottom = hasCoords ? undefined : 80;

  return (
    <>
      {/* Backdrop — tap to dismiss */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress} />

      {/* Card */}
      <View
        onLayout={handleCardLayout}
        style={[
          styles.card,
          hasCoords
            ? { left: cardLeft, top: cardTop }
            : { left: spacing.md, right: spacing.md, bottom: cardBottom },
        ]}
      >
        {/* Title */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {source === 'ute' && (
            <View style={styles.uteBadge}>
              <Text style={styles.uteBadgeText}>UTE</Text>
            </View>
          )}
        </View>

        {source === 'ute' ? (
          /* ── UTE connector list ────────────────────────── */
          <View style={styles.uteConnectors}>
            {connectors.map((conn, i) => (
              <Text key={i} style={styles.uteConnectorRow}>
                {CONNECTOR_LABEL[conn.type]} · {conn.power_kw} kW × {conn.count}
                {conn.status ? ` · ${conn.status}` : ''}
              </Text>
            ))}
          </View>
        ) : (
          /* ── P2P single connector + price ──────────────── */
          <>
            <View style={styles.infoRow}>
              <Text style={styles.info}>
                {CONNECTOR_LABEL[connectorType]} · {powerKw} kW
              </Text>
              <Text style={styles.infoDot}>·</Text>
              <Text style={styles.info}>
                {formatPrice(pricePerHour, currency)}/h
              </Text>
            </View>
          </>
        )}

        {/* Row: distance + Ver button (P2P only) */}
        <View style={styles.actionRow}>
          <View style={styles.distanceWrap}>
            {showLoading ? (
              <ActivityIndicator size={12} color={colors.primary} />
            ) : displayDistance != null ? (
              <Text style={styles.distance}>
                ~{formatDistance(displayDistance)} por ruta
              </Text>
            ) : null}
          </View>
          {source !== 'ute' && (
            <Pressable style={styles.verButton} onPress={onPressDetail}>
              <Text style={styles.verButtonText}>Ver</Text>
            </Pressable>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
    zIndex: 31,
    ...shadows.card,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  uteBadge: {
    backgroundColor: '#1E6BF5',
    borderRadius: radius.button,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  uteBadgeText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 10,
  },
  uteConnectors: {
    gap: 2,
  },
  uteConnectorRow: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  info: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoDot: {
    ...typography.caption,
    color: colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  distanceWrap: {
    flex: 1,
  },
  distance: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  verButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  verButtonText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
