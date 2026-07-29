/**
 * ChargerBottomSheet — slide-up panel with full charger details.
 *
 * Replaces the old floating ChargerPopup. Opened by tapping the
 * ChargerCallout badge on the map. Uses @gorhom/bottom-sheet v5.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import {
  CONNECTOR_LABEL,
  connectorCurrent,
  connectorSpeedLabel,
  type ChargerSource,
  type ConnectorInfo,
  type ConnectorType,
  type Currency,
} from '@/features/chargers/types';
import { useChargingTimer } from '@/hooks/useChargingTimer';
import { isFeatureEnabled } from '@/lib/features';
import { formatPrice } from '@/lib/format';
import { getCurrentPosition, URUGUAY_FALLBACK } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';

export interface ChargerBottomSheetProps {
  visible: boolean;
  title: string;
  source: ChargerSource;
  connectors: ConnectorInfo[];
  connectorType: ConnectorType;
  powerKw: number;
  pricePerHour: number;
  currency: Currency;
  lat: number;
  lng: number;
  routeDistanceMeters?: number | null;
  stationStatus?: 'operational' | 'limited' | 'offline';
  charging_since?: string;
  onPressDetail: () => void;
  onDismiss: () => void;
}

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

// ── Component ────────────────────────────────────────────────
export function ChargerBottomSheet({
  visible,
  title,
  source,
  connectors,
  connectorType,
  powerKw,
  pricePerHour,
  currency,
  lat,
  lng,
  routeDistanceMeters,
  charging_since,
  onPressDetail,
  onDismiss,
}: ChargerBottomSheetProps) {
  const [fallbackDistance, setFallbackDistance] = useState<number | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(
    routeDistanceMeters == null,
  );

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
  const { elapsed } = useChargingTimer(
    isFeatureEnabled('CHARGING_STATUS') ? charging_since : null,
  );

  if (!visible) return null;

  return (
    <BottomSheet
      index={0}
      snapPoints={['40%']}
      enablePanDownToClose
      onClose={onDismiss}
    >
      <BottomSheetView style={styles.container}>
        {/* Title + close button */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={onDismiss}
            style={styles.closeButton}
            hitSlop={12}
            accessibilityLabel="Cerrar"
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {/* Charging elapsed timer */}
        {elapsed != null && (
          <View style={styles.chargingBadge}>
            <Text style={styles.chargingText}>
              Cargando hace {elapsed}
            </Text>
          </View>
        )}

        {/* Connectors — same layout as old ChargerPopup */}
        {connectors.map((c, i) => (
          <View key={i} style={styles.connectorRow}>
            <View style={styles.connectorDot} />
            <Text style={styles.connectorText}>
              {CONNECTOR_LABEL[c.type] ?? c.type} — {c.power_kw} kW ·{' '}
              {connectorSpeedLabel(c.power_kw)} · {connectorCurrent(c.type)}
            </Text>
          </View>
        ))}

        {/* Price */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Precio</Text>
          <Text style={styles.infoValue}>
            {formatPrice(pricePerHour, currency)}/h
          </Text>
        </View>

        {/* Distance */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Distancia</Text>
          {showLoading ? (
            <ActivityIndicator size={12} color={colors.primary} />
          ) : displayDistance != null ? (
            <Text style={styles.infoValue}>
              {formatDistance(displayDistance)}
            </Text>
          ) : null}
        </View>

        {/* Source badge + detail button */}
        <View style={styles.bottomRow}>
          <Text style={styles.sourceLabel}>
            {source === 'enchufate'
              ? 'Particular'
              : source === 'ute'
                ? 'UTE'
                : source === 'ocm'
                  ? 'Open Charge Map'
                  : source}
          </Text>
          <Pressable onPress={onPressDetail} style={styles.detailButton}>
            <Text style={styles.detailButtonText}>Ver detalle</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  chargingBadge: {
    backgroundColor: colors.charging,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button,
    alignSelf: 'flex-start',
  },
  chargingText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  connectorText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  sourceLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  detailButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
  },
  detailButtonText: {
    ...typography.caption,
    color: colors.textOnPrimary,
    fontWeight: '600',
  },
});
