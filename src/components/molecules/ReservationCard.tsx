import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Calendar, Clock, MapPin, Zap } from 'lucide-react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
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
  powerKw?: number | null;
  otherPartyName: string;
  otherPartyAvatarUri?: string | null;
  role: ReservationRole;
  onPress?: () => void;
  /**
   * Optional cancel handler. When provided AND the reservation
   * status is cancellable (`solicitada` or `confirmada`), a
   * secondary "Cancelar" Button renders below the meta rows. The
   * parent owns the confirmation modal; the card just delegates.
   */
  onCancel?: () => void;
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
  onCancel,
  style,
}: ReservationCardProps): React.JSX.Element {
  // The cancel CTA only renders when the parent provides a
  // handler AND the reservation is still cancellable. The
  // inline check matches the `isCancellable` rule from
  // `src/features/reservations/state-machine.ts` (true for
  // 'solicitada' or 'confirmada'). We inline the check
  // here because `status` is typed as `StatusPillKind` (which
  // also includes 'disponible' for the charger-card reuse
  // case) — calling the helper directly would error on the
  // 'disponible' arm. The list screen + detail screen pass a
  // `ReservationStatus` so the inline check covers the actual
  // value domain.
  const canCancel =
    Boolean(onCancel) && (status === 'solicitada' || status === 'confirmada');
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
      {canCancel ? (
        <View style={styles.actions}>
          <Button
            label="Cancelar reserva"
            variant="secondary"
            size="sm"
            fullWidth
            onPress={onCancel}
            accessibilityLabel={`Cancelar reserva de ${chargerTitle}`}
          />
        </View>
      ) : null}
    </Card>
  );
}

function formatPower(kw: number | undefined | null): string {
  if (kw == null) return '— kW';
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
  actions: { marginTop: spacing.sm },
});
