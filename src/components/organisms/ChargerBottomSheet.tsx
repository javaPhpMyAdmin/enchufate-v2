/**
 * ChargerBottomSheet — slide-up panel with full charger details.
 *
 * Replaces the old floating ChargerPopup. Opened by tapping the
 * ChargerCallout badge on the map. Uses @gorhom/bottom-sheet v5.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import {
  DirectionsSheet,
  type DirectionsSheetHandle,
} from '@/components/molecules/DirectionsSheet';
import {
  CONNECTOR_LABEL,
  connectorCurrent,
  connectorSpeedLabel,
  type ChargerSource,
  type ConnectorInfo,
  type Currency,
} from '@/features/chargers/types';
import { useChargingTimer } from '@/hooks/useChargingTimer';
import { isFeatureEnabled } from '@/lib/features';
import { formatPrice } from '@/lib/format';
import { getCurrentPosition, URUGUAY_FALLBACK } from '@/lib/location';
import { colors, radius, spacing, typography } from '@/theme';
import { Icon } from '../atoms/Icon';
import { ArrowUpRight } from 'lucide-react-native';

export interface ChargerBottomSheetProps {
  visible: boolean;
  title: string;
  source: ChargerSource;
  connectors: ConnectorInfo[];
  pricePerHour: number;
  currency: Currency;
  lat: number;
  lng: number;
  routeDistanceMeters?: number | null;
  routeDuration?: number | null;
  routeLoading?: boolean;
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

function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    const hLabel = hours === 1 ? 'hora' : 'horas';
    const mLabel = minutes === 1 ? 'minuto' : 'minutos';

    // Si los minutos son 0 (ej: justo 2 horas), omitimos los minutos
    return minutes > 0
      ? `${hours} ${hLabel} y ${minutes} ${mLabel}`
      : `${hours} ${hLabel}`;
  }

  const mLabel = totalMinutes === 1 ? 'minuto' : 'minutos';
  return `${totalMinutes} ${mLabel}`;
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
  pricePerHour,
  currency,
  lat,
  lng,
  routeDistanceMeters,
  routeDuration,
  routeLoading = false,
  charging_since,
  onPressDetail,
  onDismiss,
}: ChargerBottomSheetProps) {
  const [fallbackDistance, setFallbackDistance] = useState<number | null>(null);
  const directionsSheetRef = useRef<DirectionsSheetHandle>(null);

  // Haversine fallback — only when OSRM finished loading without a result
  // (offline, OSRM unavailable, or route too short). Waits for routeLoading
  // to resolve before computing so "Calculando ruta..." isn't interrupted.
  useEffect(() => {
    if (routeDistanceMeters != null) {
      setFallbackDistance(null);
      return;
    }
    if (routeLoading) return; // wait — OSRM fetch is still in flight
    let mounted = true;
    getCurrentPosition().then((pos) => {
      if (!mounted) return;
      const userLat = pos?.lat ?? URUGUAY_FALLBACK.lat;
      const userLng = pos?.lng ?? URUGUAY_FALLBACK.lng;
      setFallbackDistance(haversineMeters(userLat, userLng, lat, lng));
    });
    return () => {
      mounted = false;
    };
  }, [routeDistanceMeters, routeLoading, lat, lng]);

  const displayDistance = routeDistanceMeters ?? fallbackDistance;
  const { elapsed } = useChargingTimer(
    isFeatureEnabled('CHARGING_STATUS') ? charging_since : null,
  );

  if (!visible) return null;

  return (
    <>
      <BottomSheet
        index={0}
        snapPoints={['45%']}
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
              <Text style={styles.closeText}>X</Text>
            </Pressable>
          </View>

          {/* Charging elapsed timer */}
          {elapsed != null && (
            <View style={styles.chargingBadge}>
              <Text style={styles.chargingText}>Cargando hace {elapsed}</Text>
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

          {source === 'enchufate' ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Precio</Text>
              <Text style={styles.infoValue}>
                {formatPrice(pricePerHour, currency)}/h
              </Text>
            </View>
          ) : null}
          {/* <Text style={styles.infoLabel}>Precio</Text>
          <Text style={styles.infoValue}>
            {formatPrice(pricePerHour, currency)}/h
          </Text> */}

          {/* Distance */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Distancia</Text>
            {routeLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size={12} color={colors.primary} />
                <Text style={styles.loadingText}>Calculando ruta...</Text>
              </View>
            ) : displayDistance != null ? (
              <>
                <Text style={styles.infoValue}>
                  {formatDistance(displayDistance)}
                </Text>
              </>
            ) : null}
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duración estimada</Text>
            {routeLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size={12} color={colors.primary} />
                <Text style={styles.loadingText}>Calculando ruta...</Text>
              </View>
            ) : routeDuration != null ? (
              <Text style={styles.infoValue}>
                {formatDuration(routeDuration)}
              </Text>
            ) : null}
          </View>

          {/* Source badge + detail button */}
          <View style={styles.bottomRow}>
            <Text style={styles.sourceLabel}>
              {source === 'enchufate' ? 'Particular' : null}
            </Text>
            {source === 'enchufate' ? (
              <Pressable onPress={onPressDetail} style={styles.detailButton}>
                <Text style={styles.detailButtonText}>Ver detalle</Text>
              </Pressable>
            ) : null}
          </View>
          {source != 'enchufate' ? (
            <View style={{ alignItems: 'center', marginTop: spacing.md }}>
              <Pressable
                onPress={() =>
                  directionsSheetRef.current?.checkAndOpen({ lat, lng, title })
                }
                style={styles.howtoButton}
              >
                <Text style={styles.detailButtonText}>Como llegar</Text>
                <Icon
                  icon={ArrowUpRight}
                  size="sm"
                  color={colors.textOnPrimary}
                />
              </Pressable>
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
      <DirectionsSheet ref={directionsSheetRef} />
    </>
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
  howtoButton: {
    width: '80%',
    height: 40,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
