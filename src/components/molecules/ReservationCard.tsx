import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Calendar, Clock, MapPin, Zap } from 'lucide-react-native';

import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Icon } from '@/components/atoms/Icon';
import { StatusPill, type StatusPillKind } from '@/components/atoms/StatusPill';
import { useResolvedAddress } from '@/features/chargers/hooks/useResolvedAddress';
import { useChargingTimer } from '@/hooks/useChargingTimer';
import { isFeatureEnabled } from '@/lib/features';
import { colors, spacing, typography } from '@/theme';

export type ReservationRole = 'renter' | 'host';

export interface ReservationCardProps {
  status: StatusPillKind;
  chargerTitle: string;
  address: string;
  /** Charger latitude for reverse-geocoding coordinate addresses. */
  lat?: number;
  /** Charger longitude for reverse-geocoding coordinate addresses. */
  lng?: number;
  timeBlock: string;
  powerKw?: number | null;
  otherPartyName: string;
  otherPartyAvatarUri?: string | null;
  role: ReservationRole;
  onPress?: () => void;
  /**
   * Whether the cancel CTA should render. Computed by the parent
   * with `isCancellable(reservation)` from the reservation
   * state-machine (time-aware) — the card itself stays
   * status-agnostic and just delegates.
   */
  canCancel?: boolean;
  /**
   * Optional cancel handler. When provided AND `canCancel` is
   * true, a secondary "Cancelar reserva" Button renders below the
   * meta rows. The parent owns the confirmation modal; the card
   * just delegates.
   */
  onCancel?: () => void;
  /**
   * Optional end-charging handler. When provided AND status is
   * `en_curso` AND the `CHARGING_STATUS` feature flag is on, a
   * danger "Finalizar carga" Button renders below the meta rows.
   * The parent owns the confirmation flow; the card delegates.
   */
  onEndCharging?: () => void;
  /** True while the end-charging mutation is in flight. */
  isEndingCharging?: boolean;
  /**
   * Optional review CTA callback. When set AND status is
   * `completada` AND the `CHARGER_REVIEWS` feature flag is on,
   * a "Dejar reseña" button renders below the card content.
   */
  onReviewPress?: () => void;
  /** ISO 8601 — set when charging is active (status 'en_curso'). */
  chargingStartedAt?: string | null;
  style?: StyleProp<ViewStyle>;
}

/** Reservation row used on the "Mis reservas" / "En mis cargadores" lists. */
export function ReservationCard({
  status,
  chargerTitle,
  address,
  lat = 0,
  lng = 0,
  timeBlock,
  powerKw,
  otherPartyName,
  otherPartyAvatarUri,
  role,
  onPress,
  canCancel,
  onCancel,
  onEndCharging,
  isEndingCharging,
  onReviewPress,
  chargingStartedAt,
  style,
}: ReservationCardProps): React.JSX.Element {
  const resolvedAddress = useResolvedAddress(address, lat, lng);
  const displayAddress = resolvedAddress.data ?? address;
  const { elapsed } = useChargingTimer(
    isFeatureEnabled('CHARGING_STATUS') && status === 'en_curso'
      ? chargingStartedAt
      : null,
  );
  // The cancel CTA renders only when the parent provides a
  // handler AND the parent computed the reservation as still
  // cancellable (time-aware `isCancellable` from the state
  // machine — the card lacks `end_at` to judge itself).
  const canShowCancel = Boolean(onCancel) && canCancel === true;
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
            {displayAddress}
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
        {elapsed ? (
          <View style={styles.chargingTimerRow}>
            <Text style={styles.chargingTimerText}>
              ⚡ Cargando hace {elapsed}
            </Text>
          </View>
        ) : null}
      </View>
      {canShowCancel ? (
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
      {isFeatureEnabled('CHARGING_STATUS') &&
      status === 'en_curso' &&
      onEndCharging ? (
        <View style={styles.actions}>
          <Button
            label={isEndingCharging ? 'Finalizando...' : 'Finalizar carga'}
            variant="danger"
            size="sm"
            fullWidth
            disabled={isEndingCharging}
            onPress={onEndCharging}
            accessibilityLabel={`Finalizar carga en ${chargerTitle}`}
          />
        </View>
      ) : null}
      {isFeatureEnabled('CHARGER_REVIEWS') && status === 'completada' && onReviewPress ? (
        <View style={styles.actions}>
          <Button
            label="Dejar reseña"
            variant="secondary"
            size="sm"
            fullWidth
            onPress={onReviewPress}
            accessibilityLabel={`Dejar reseña para ${chargerTitle}`}
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
  chargingTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  chargingTimerText: {
    ...typography.caption,
    color: colors.charging,
    fontWeight: '700',
  },
  actions: { marginTop: spacing.sm },
});
