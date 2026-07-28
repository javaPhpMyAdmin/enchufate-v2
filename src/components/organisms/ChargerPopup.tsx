/**
 * ChargerPopup — preview card for a selected charger marker.
 *
 * Rendered at the bottom of the map (not overlaying it), so map gestures
 * like pinch-to-zoom always work. Distance is fetched by the parent
 * (map.tsx) via OSRM and passed as routeDistanceMeters.
 *
 * Dismiss via the ✕ close button.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;

import {
  CONNECTOR_LABEL,
  connectorCurrent,
  connectorSpeedLabel,
  type ChargerSource,
  type ConnectorInfo,
  type ConnectorType,
  type Currency,
} from '@/features/chargers/types';
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
  /** Screen-space coordinates of the marker pin — card floats above this. */
  position?: { x: number; y: number } | null;
  routeDistanceMeters?: number | null;
  stationStatus?: 'operational' | 'limited' | 'offline';
  onPressDetail: () => void;
  onDismiss: () => void;
}

const CARD_WIDTH = 230;

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

/** Haversine fallback when OSRM is unavailable. */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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
  const [loadingFallback, setLoadingFallback] = useState(
    routeDistanceMeters == null,
  );
  const [cardHeight, setCardHeight] = useState(0);
  const insets = useSafeAreaInsets();

  const handleCardLayout = useCallback((e: LayoutChangeEvent) => {
    setCardHeight(e.nativeEvent.layout.height);
  }, []);

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
    return () => {
      mounted = false;
    };
  }, [routeDistanceMeters, lat, lng]);

  const displayDistance = routeDistanceMeters ?? fallbackDistance;
  const showLoading = loadingFallback && displayDistance == null;

  // ── Position card above the marker (no backdrop — map stays interactable) ──
  const hasCoords = position != null;
  const cardLeft = hasCoords
    ? Math.max(
        8,
        Math.min(position.x - CARD_WIDTH / 2, SCREEN_WIDTH - CARD_WIDTH - 8),
      )
    : spacing.md;
  const cardTop = hasCoords
    ? Math.max(insets.top + 8, position.y - cardHeight - 10)
    : undefined;
  const cardBottom = hasCoords ? undefined : 80;

  return (
    <View
      onLayout={handleCardLayout}
      style={[
        styles.card,
        hasCoords
          ? { left: cardLeft, top: cardTop }
          : { left: spacing.md, right: spacing.md, bottom: cardBottom },
      ]}
    >
      {/* Title + close button */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {/* {source === 'ocm' && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>OCM</Text>
          </View>
        )}
        {source === 'ute' && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>UTE</Text>
          </View>
        )} */}
        <Pressable
          onPress={onDismiss}
          style={styles.closeButton}
          hitSlop={8}
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>

      {source === 'ute' ? (
        /* ── UTE connector list ────────────────────────── */
        <View style={styles.uteConnectors}>
          {connectors.map((conn, i) => {
            const current = connectorCurrent(conn.type);
            const speed = connectorSpeedLabel(conn.power_kw);
            const cableLabel = conn.has_cable ? 'Con cable' : 'Sin cable';
            const statusLabel = conn.status === 'available'
              ? 'Disponible'
              : conn.status === 'occupied'
                ? 'Ocupado'
                : null;
            return (
              <View key={i} style={styles.uteConnectorRow}>
                <Text style={styles.uteConnectorText}>
                  {CONNECTOR_LABEL[conn.type]} · {conn.power_kw} kW · {speed} (
                  {current})
                </Text>
                <View style={styles.uteMetaRow}>
                  <Text style={styles.uteConnectorMeta}>
                    Conectores {conn.count} · {cableLabel}
                    {statusLabel ? ` · ${statusLabel}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : source === 'ocm' && connectors.length > 0 ? (
        /* ── OCM connector list ──────────────────────── */
        <View style={styles.ocmConnectors}>
          {connectors.map((conn, i) => {
            const speed = connectorSpeedLabel(conn.power_kw);
            const cableLabel =
              conn.has_cable != null
                ? conn.has_cable
                  ? ' · Con cable'
                  : ' · Sin cable'
                : '';
            return (
              <View key={i} style={styles.ocmConnectorRow}>
                <Text style={styles.ocmConnectorText}>
                  {CONNECTOR_LABEL[conn.type]} · {conn.power_kw} kW · {speed}
                </Text>
                <Text style={styles.ocmConnectorMeta}>
                  {conn.count} conector{conn.count > 1 ? 'es' : ''}
                  {cableLabel}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        /* ── P2P (enchufate) single connector ─────────── */
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
              {formatDistance(displayDistance)}.
            </Text>
          ) : null}
        </View>
        {source === 'enchufate' && (
          <Pressable style={styles.verButton} onPress={onPressDetail}>
            <Text style={styles.verButtonText}>Ver</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 5,
    zIndex: 31,
    ...shadows.card,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  badgeText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 9,
  },
  closeButton: {
    marginLeft: 'auto',
    padding: 2,
  },
  closeIcon: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  uteConnectors: {
    gap: 4,
  },
  uteConnectorRow: {
    gap: 2,
  },
  uteConnectorText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  uteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uteConnectorMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12.5,
    opacity: 0.8,
  },
  ocmConnectors: {
    gap: 4,
  },
  ocmConnectorRow: {
    gap: 1,
  },
  ocmConnectorText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  ocmConnectorMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12.5,
    opacity: 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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
    fontWeight: '800',
  },
  verButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.button,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: spacing.sm,
    width: 80,
  },
  verButtonText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
});
