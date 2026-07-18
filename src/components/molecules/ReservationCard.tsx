import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Calendar, Clock, MapPin, Zap } from 'lucide-react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StatusPill, type StatusPillKind } from '@/components/atoms/StatusPill';
import { colors, spacing, typography } from '@/theme';

export type ReservationRole = 'renter' | 'host';

export interface ReservationCardProps {
  status: StatusPillKind;
  chargerTitle: string;
  address: string;
  timeBlock: string;
  powerKw: number;
  otherPartyName: string;
  otherPartyAvatarUri?: string | null;
  role: ReservationRole;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Reservation row used on the "Mis reservas" / "En mis cargadores" lists. */
export function ReservationCard({
  status,
  chargerTitle,
  address,
  timeBlock,
  powerKw,
  otherPartyName,
  otherPartyAvatarUri,
  role,
  onPress,
  style,
}: ReservationCardProps): React.JSX.Element {
  return (
    <Card variant="default" padding="md" onPress={onPress} accessibilityLabel={chargerTitle} style={style}>
      <View style={styles.header}>
        <Avatar uri={otherPartyAvatarUri} name={otherPartyName} size="sm" />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {chargerTitle}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {otherPartyName} · {role === 'renter' ? 'Anfitrión' : 'Huésped'}
          </Text>
        </View>
        <StatusPill status={status} />
      </View>
      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Icon icon={MapPin} size="sm" color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {address}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Icon icon={Calendar} size="sm" color={colors.textSecondary} />
          <Icon icon={Clock} size="sm" color={colors.textSecondary} />
          <Text style={styles.metaText}>{timeBlock}</Text>
        </View>
        <View style={styles.metaRow}>
          <Icon icon={Zap} size="sm" color={colors.textSecondary} />
          <Text style={styles.metaText}>{formatPower(powerKw)}</Text>
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
  subtitle: { ...typography.caption, color: colors.textSecondary },
  meta: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
});
