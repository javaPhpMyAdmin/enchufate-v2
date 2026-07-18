import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MapPin, Zap } from 'lucide-react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StatusPill, type StatusPillKind } from '@/components/atoms/StatusPill';
import { colors, spacing, typography } from '@/theme';

export interface ChargerCardProps {
  title: string;
  address: string;
  powerKw: number;
  status: StatusPillKind;
  /** Optional host display name; when set, the card shows the host's avatar. */
  hostName?: string;
  /** Optional host avatar URL. */
  hostAvatarUri?: string | null;
  /** Whole-card press handler; navigates to charger detail in Phase 6. */
  onPress?: () => void;
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
 */
export function ChargerCard({
  title,
  address,
  powerKw,
  status,
  hostName,
  hostAvatarUri,
  onPress,
  style,
}: ChargerCardProps): React.JSX.Element {
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
              {address}
            </Text>
          </View>
        </View>
        <StatusPill status={status} />
      </View>
      <View style={styles.footer}>
        <View style={styles.row}>
          <Icon icon={Zap} size="sm" color={colors.primary} />
          <Text style={styles.power}>{formatPower(powerKw)}</Text>
        </View>
      </View>
    </Card>
  );
}

function formatPower(kw: number): string {
  return `${kw.toFixed(kw % 1 === 0 ? 0 : 1)} kW`;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.heading, color: colors.textPrimary },
  address: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  footer: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  power: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
});
