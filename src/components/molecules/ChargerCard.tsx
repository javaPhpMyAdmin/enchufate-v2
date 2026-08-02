import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MapPin, Zap } from 'lucide-react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StatusPill, type StatusPillKind } from '@/components/atoms/StatusPill';
import { useResolvedAddress } from '@/features/chargers/hooks/useResolvedAddress';
import { useChargingTimer } from '@/hooks/useChargingTimer';
import { formatPower } from '@/lib/format';
import { colors, spacing, typography } from '@/theme';

export interface ChargerCardProps {
  title: string;
  address: string;
  powerKw: number;
  status: StatusPillKind;
  /** Charger latitude — used to reverse-geocode when `address` looks like coordinates. */
  lat?: number;
  /** Charger longitude — used to reverse-geocode when `address` looks like coordinates. */
  lng?: number;
  /** Optional host display name; when set, the card shows the host's avatar. */
  hostName?: string;
  /** Optional host avatar URL. */
  hostAvatarUri?: string | null;
  /** Whole-card press handler; navigates to charger detail in Phase 6. */
  onPress?: () => void;
  /** When set, the charger has an active charging session; the card shows a live elapsed timer. */
  chargingStartedAt?: string | null;
  /** Optional accessory rendered in the footer row (e.g. action buttons). */
  footerAccessory?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * ChargerCard — a single charger summary.
 *
 * Used on:
 *   - Inicio (Phase 4, optional)
 *   - Map list (Phase 4, optional)
 *   - Profile "Mis cargadores" (Phase 5)
 *   - Reservation detail (Phase 5)
 *
 * Composes `Card` + `Avatar` (host) + `StatusPill` + `Icon`. The
 * card is a `Pressable` when `onPress` is provided.
 *
 * When `lat`/`lng` are provided, the card auto-resolves coordinate
 * addresses to human-readable form via reverse geocoding.
 */
export function ChargerCard({
  title,
  address,
  powerKw,
  status,
  lat = 0,
  lng = 0,
  hostName,
  hostAvatarUri,
  onPress,
  chargingStartedAt,
  footerAccessory,
  style,
}: ChargerCardProps): React.JSX.Element {
  const resolvedAddress = useResolvedAddress(address, lat, lng);
  const displayAddress = resolvedAddress.data ?? address;
  const { elapsed } = useChargingTimer(chargingStartedAt);

  return (
    <Card variant="default" padding="md" onPress={onPress} accessibilityLabel={title} style={style}>
      <View style={styles.header}>
        {hostName ? <Avatar uri={hostAvatarUri} name={hostName} size="sm" /> : null}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.row}>
            <Icon icon={MapPin} size="sm" color={colors.textSecondary} />
            <Text style={styles.address} numberOfLines={1}>
              {displayAddress}
            </Text>
          </View>
        </View>
        {elapsed ? (
          <StatusPill status="en_curso" label={`En carga · ${elapsed}`} />
        ) : (
          <StatusPill status={status} />
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.row}>
            <Icon icon={Zap} size="sm" color={colors.primary} />
            <Text style={styles.power}>{formatPower(powerKw)}</Text>
          </View>
        </View>
        {footerAccessory ? <View style={styles.footerRight}>{footerAccessory}</View> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.heading, color: colors.textPrimary },
  address: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: { flex: 1 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  power: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
});
