/**
 * Reservation detail — `/reservation/[id]`.
 *
 * One state (the screen is only reachable when the user is signed
 * in and the reservation exists). Renders the full reservation:
 *   - Charger info card (title, address, connector + power, price)
 *   - Other-party block (avatar + name + role label)
 *   - Cancel-reason card (when `status === 'cancelada'` and a
 *     `cancel_reason` was given — visible to both parties)
 *   - Time block (structured start_at – end_at OR the
 *     `horario_a_coordinar` free-text)
 *   - Status pill
 *   - "Cómo llegar" link → opens the charger location in the
 *     system browser with a Google Maps URL
 *   - "Chatear" Button → navigates to the paired conversation
 *     thread at `/messages/[conversation_id]`
 *   - "Cancelar reserva" Button (only when `isCancellable(r)`
 *     is true) → opens a `ConfirmModal` (Phase 7 task 7.6). On
 *     confirm, calls `useCancelReservation().cancel(id)` which
 *     hits the real Supabase path (or the mock when the
 *     MOCK_SUPABASE flag is on). The
 *     `handle_reservation_cancelled_system_message` trigger
 *     injects the voseo system message with the formatted
 *     `time_desc` into the conversation.
 *
 * The cancel confirm copy is the spec-required "¿Cancelar la
 * reserva de {chargerTitle}?" with two actions: "Volver" (closes
 * the modal) and "Cancelar y volver" (commits the cancel and
 * pops the screen).
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  MapPin,
  MessageCircle,
  Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { StatusPill } from '@/components/atoms/StatusPill';
import { Icon } from '@/components/atoms/Icon';
import { ConfirmModal } from '@/components/molecules/ConfirmModal';
import { ErrorState } from '@/components/molecules/ErrorState';
import { LoadingState } from '@/components/molecules/LoadingState';
import { useSession } from '@/features/auth/hooks/useSession';
import { useCancelReservation } from '@/features/reservations/hooks/useCancelReservation';
import { useConfirmReservation } from '@/features/reservations/hooks/useConfirmReservation';
import { useEndCharging } from '@/features/reservations/mutations/endCharging';
import { useStartCharging } from '@/features/reservations/mutations/startCharging';
import { useReservation } from '@/features/reservations/hooks/useReservation';
import { useChargingTimer } from '@/hooks/useChargingTimer';
import { useNotifyCompletion } from '@/features/reservations/hooks/useNotifyCompletion';
import { useReviewEligibility } from '@/features/reviews/hooks/useReviewEligibility';
import { useResolvedAddress } from '@/features/chargers/hooks/useResolvedAddress';
import {
  isCancellable,
  otherParty,
  timeBlock,
  type ReservationStatus,
} from '@/features/reservations/types';
import { isFeatureEnabled } from '@/lib/features';
import { formatPower } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

export default function ReservationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const reservationId = typeof params.id === 'string' ? params.id : null;

  const { session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const reservation = useReservation(reservationId);
  const { cancel, isPending: isCancelling, error: cancelError } = useCancelReservation();
  const { confirm, isPending: isConfirming, error: confirmError } = useConfirmReservation();
  const { startCharging, isPending: isStartingCharging, error: startChargingError } = useStartCharging();
  const { endCharging, isPending: isEndingCharging, error: endChargingError } = useEndCharging();
  const reviewEligibility = useReviewEligibility(reservationId);

  // Resolve coordinate addresses to human-readable form
  const resolvedAddress = useResolvedAddress(
    reservation.data?.charger_address ?? '',
    reservation.data?.charger_lat ?? 0,
    reservation.data?.charger_lng ?? 0,
  );

  // Send a review-prompt push when the reservation transitions to
  // `completada` (set by DB trigger, not a client mutation).
  useNotifyCompletion(reservation.data);

  // The confirm modal visibility state. We hold the modal open
  // while the mutation is in flight so the user can't double-tap;
  // the Button's `loading` prop shows the spinner.
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showConfirmSuccess, setShowConfirmSuccess] = useState(false);

  // Timer for active charging session.
  const { elapsed } = useChargingTimer(
    isFeatureEnabled('CHARGING_STATUS') &&
    reservation.data?.status === 'en_curso'
      ? reservation.data.charging_started_at
      : null,
  );

  const [endChargingModalVisible, setEndChargingModalVisible] = useState(false);

  // Surface mutation errors via an Alert. The hook already
  // normalizes to AppError, so the `userMessage` is voseo + safe.
  if (cancelError && !cancelModalVisible) {
    Alert.alert('No pudimos cancelar la reserva', cancelError.userMessage);
  }
  if (confirmError) {
    Alert.alert('No pudimos confirmar la reserva', confirmError.userMessage);
  }
  if (startChargingError && !endChargingModalVisible) {
    Alert.alert('No pudimos iniciar la carga', startChargingError.userMessage);
  }
  if (endChargingError && !endChargingModalVisible) {
    Alert.alert('No pudimos finalizar la carga', endChargingError.userMessage);
  }

  const onCancelPress = useCallback(() => {
    setCancelModalVisible(true);
  }, []);

  const onCancelConfirm = useCallback(async () => {
    if (!reservation.data) return;
    try {
      await cancel(reservation.data, cancelReason || undefined);
      setCancelModalVisible(false);
      setCancelReason('');
      // Pop back to the reservations list. The TanStack Query
      // invalidations in the hook refresh the list on focus.
      router.back();
    } catch {
      // The mutation already populates `cancelError`; the
      // Alert.alert above surfaces it on the next render. We
      // keep the modal open so the user can retry or close.
    }
  }, [cancel, reservation.data, cancelReason, router]);

  const onCancelClose = useCallback(() => {
    if (isCancelling) return; // ignore close while in flight
    setCancelModalVisible(false);
    setCancelReason('');
  }, [isCancelling]);

  const onConfirmPress = useCallback(async () => {
    if (!reservation.data) return;
    try {
      await confirm(reservation.data.id, reservation.data.status as ReservationStatus);
      setShowConfirmSuccess(true);
    } catch {
      // Error surfaced via confirmError Alert above.
    }
  }, [confirm, reservation.data]);

  const onStartChargingPress = useCallback(async () => {
    if (!reservation.data) return;
    try {
      await startCharging(reservation.data.id, reservation.data.status as ReservationStatus);
    } catch {
      // Error surfaced via startChargingError Alert.
    }
  }, [startCharging, reservation.data]);

  const onEndChargingPress = useCallback(() => {
    setEndChargingModalVisible(true);
  }, []);

  const onEndChargingConfirm = useCallback(async () => {
    if (!reservation.data) return;
    try {
      await endCharging(reservation.data.id, reservation.data.status as ReservationStatus);
      setEndChargingModalVisible(false);
      router.back();
    } catch {
      // Error surfaced via endChargingError Alert.
    }
  }, [endCharging, reservation.data, router]);

  const onEndChargingClose = useCallback(() => {
    if (isEndingCharging) return;
    setEndChargingModalVisible(false);
  }, [isEndingCharging]);

  const onOpenInMaps = useCallback(() => {
    if (!reservation.data) return;
    const { charger_lat, charger_lng, charger_title } = reservation.data;
    // Google Maps universal URL — works on iOS, Android, and web.
    const url = `https://www.google.com/maps/dir/?api=1&destination=${charger_lat},${charger_lng}&destination_place_id=${encodeURIComponent(charger_title)}`;
    void Linking.openURL(url).catch(() => {
      Alert.alert('No pudimos abrir el mapa', 'Probá más tarde.');
    });
  }, [reservation.data]);

  const onChat = useCallback(() => {
    if (!reservation.data) return;
    router.push(`/messages/${reservation.data.conversation_id}` as never);
  }, [reservation.data, router]);

  if (sessionLoading) {
    return <LoadingState />;
  }

  if (!session) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="Necesitás iniciar sesión"
          body="Iniciá sesión para ver los detalles de una reserva."
          onRetry={() => router.push('/login?returnTo=/reservations' as never)}
          retryLabel="Iniciá sesión"
        />
      </View>
    );
  }

  if (!reservationId) {
    return (
      <View style={styles.flex}>
        <ErrorState
          title="Reserva no encontrada"
          body="El enlace que seguiste no apunta a una reserva válida."
          onRetry={() => router.replace('/reservations' as never)}
          retryLabel="Volver a reservas"
        />
      </View>
    );
  }

  if (reservation.isLoading) {
    return <LoadingState label="Cargando reserva..." />;
  }

  if (reservation.error) {
    return (
      <ErrorState
        body={reservation.error.userMessage}
        onRetry={() => reservation.refetch()}
        retryLabel="Reintentar"
      />
    );
  }

  if (!reservation.data) {
    return (
      <ErrorState
        title="Reserva no encontrada"
        body="No encontramos esta reserva. Es posible que haya sido eliminada."
        onRetry={() => router.replace('/reservations' as never)}
        retryLabel="Volver a reservas"
      />
    );
  }

  const r = reservation.data;
  const party = otherParty(r, userId ?? 'mock-uid');
  const isMine = userId && r.renter_id === userId;
  const partyRole = isMine ? 'Anfitrión' : 'Huésped';

  return (
    <View style={styles.flex}>
      {/* Header (custom, not Stack.Screen) */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          style={styles.backButton}
        >
          <Icon icon={ChevronLeft} size="lg" color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Detalle de reserva
        </Text>
        <View style={styles.statusPillWrap}>
          <StatusPill status={r.status} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Charger info */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.chargerTitle} numberOfLines={2}>
            {r.charger_title}
          </Text>
          <View style={styles.metaRow}>
            <Icon icon={MapPin} size="sm" color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={2}>
              {resolvedAddress.data ?? r.charger_address}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Icon icon={Zap} size="sm" color={colors.primary} />
            <Text style={styles.metaText}>
              {r.charger_connector_type.toUpperCase()} · {formatPower(r.charger_power_kw)}
            </Text>
          </View>
          <Pressable
            onPress={onOpenInMaps}
            accessibilityRole="link"
            accessibilityLabel="Cómo llegar"
            style={styles.howToGetThere}
          >
            <Text style={styles.howToGetThereText}>Cómo llegar</Text>
            <Icon icon={ArrowUpRight} size="sm" color={colors.primary} />
          </Pressable>
        </Card>

        {/* Time block */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Cuándo</Text>
          <View style={styles.metaRow}>
            <Icon icon={Calendar} size="sm" color={colors.textSecondary} />
            <Text style={styles.metaText}>{timeBlock(r)}</Text>
          </View>
        </Card>

        {/* Other party */}
        <Card variant="default" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>{partyRole}</Text>
          <View style={styles.partyRow}>
            <Avatar uri={party.avatarUrl} name={party.name} size="md" />
            <View style={styles.partyText}>
              <Text style={styles.partyName} numberOfLines={1}>
                {party.name}
              </Text>
              <Text style={styles.partyRole}>{partyRole}</Text>
            </View>
          </View>
        </Card>

        {/* Cancel reason — visible to both parties once a cancelled
            reservation carries a reason. */}
        {r.status === 'cancelada' && r.cancel_reason ? (
          <Card
            variant="default"
            padding="md"
            style={styles.cancelReasonCard}
          >
            <Text style={styles.cancelReasonTitle}>Motivo de cancelación</Text>
            <Text style={styles.cancelReasonBody}>{r.cancel_reason}</Text>
          </Card>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="Chatear"
            variant="primary"
            fullWidth
            leftIcon={<Icon icon={MessageCircle} size="md" color={colors.textOnPrimary} />}
            onPress={onChat}
          />
          {/* Charging status: gated behind CHARGING_STATUS flag */}
          {isFeatureEnabled('CHARGING_STATUS') ? (
            <>
              {/* Active charging timer — visible when charging is in progress. */}
              {r.status === 'en_curso' && elapsed ? (
                <View style={styles.chargingTimerRow}>
                  <Text style={styles.chargingTimerText}>
                    ⚡ Cargando hace {elapsed}
                  </Text>
                </View>
              ) : null}
              {/* Start charging: host only, when status is 'confirmada'. */}
              {userId === r.host_id && r.status === 'confirmada' ? (
                <Button
                  label={isStartingCharging ? 'Iniciando...' : 'Iniciar carga'}
                  variant="primary"
                  fullWidth
                  onPress={onStartChargingPress}
                  disabled={isStartingCharging}
                />
              ) : null}
              {/* End charging: both parties, when status is 'en_curso'. */}
              {r.status === 'en_curso' ? (
                <Button
                  label={isEndingCharging ? 'Finalizando...' : 'Finalizar carga'}
                  variant="danger"
                  fullWidth
                  onPress={onEndChargingPress}
                  disabled={isEndingCharging}
                />
              ) : null}
            </>
          ) : null}
          {/* Confirm: visible only for the host when status is 'solicitada' */}
          {userId === r.host_id && r.status === 'solicitada' ? (
            <Button
              label={isConfirming ? 'Confirmando...' : 'Confirmar reserva'}
              variant="primary"
              fullWidth
              onPress={onConfirmPress}
              disabled={isConfirming}
            />
          ) : null}
          {isCancellable(r) ? (
            <Button
              label="Cancelar reserva"
              variant="danger"
              fullWidth
              onPress={onCancelPress}
              style={styles.cancelButton}
            />
          ) : null}
          {/* Review CTA: renter on a completada reservation with no existing review */}
          {isFeatureEnabled('CHARGER_REVIEWS') &&
          r.status === 'completada' &&
          isMine &&
          reviewEligibility.data?.canReview ? (
            <Button
              label="Dejar reseña"
              variant="secondary"
              fullWidth
              onPress={() => router.push(`/review/${r.id}` as never)}
            />
          ) : null}
        </View>
      </ScrollView>

      <ConfirmModal
        visible={cancelModalVisible}
        onClose={onCancelClose}
        onConfirm={onCancelConfirm}
        title={`¿Cancelar la reserva de ${r.charger_title}?`}
        body="Podés indicar un motivo (opcional). Esta acción no se puede deshacer."
        confirmLabel="Cancelar y volver"
        cancelLabel="Volver"
        variant="danger"
        loading={isCancelling}
      >
        <TextInput
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder="Motivo de cancelación (opcional)"
          placeholderTextColor={colors.textSecondary}
          style={styles.reasonInput}
          multiline
          maxLength={500}
          editable={!isCancelling}
        />
      </ConfirmModal>

      {/* End-charging confirmation — gated behind CHARGING_STATUS flag */}
      {isFeatureEnabled('CHARGING_STATUS') ? (
        <ConfirmModal
          visible={endChargingModalVisible}
          onClose={onEndChargingClose}
          onConfirm={onEndChargingConfirm}
          title={`¿Finalizar la carga de ${r.charger_title}?`}
          body="Confirmá que ya terminaste de cargar. Esta acción no se puede deshacer."
          confirmLabel="Finalizar carga"
          cancelLabel="Volver"
          variant="danger"
          loading={isEndingCharging}
        />
      ) : null}

      {/* ---- Success modal ---- */}
      <Modal visible={showConfirmSuccess} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <CheckCircle2 size={64} color={colors.success} strokeWidth={2} />
            <Text style={styles.modalTitle}>¡Reserva confirmada!</Text>
            <Text style={styles.modalBody}>
              El huésped será notificado de la confirmación.
            </Text>
            <Button
              label="Continuar"
              variant="primary"
              fullWidth
              onPress={() => {
                setShowConfirmSuccess(false);
                router.back();
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: spacing.xs, marginLeft: -spacing.xs },
  headerTitle: { ...typography.heading, color: colors.textPrimary, flex: 1 },
  statusPillWrap: {},

  scroll: { padding: spacing.base, gap: spacing.base },

  card: { gap: spacing.sm },
  chargerTitle: { ...typography.title, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.body, color: colors.textSecondary, flex: 1 },

  howToGetThere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  howToGetThereText: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  sectionTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },

  partyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  partyText: { flex: 1, gap: 2 },
  partyName: { ...typography.heading, color: colors.textPrimary },
  partyRole: { ...typography.caption, color: colors.textSecondary },

  cancelReasonCard: {
    gap: spacing.sm,
    backgroundColor: colors.dangerSurface,
  },
  cancelReasonTitle: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cancelReasonBody: { ...typography.body, color: colors.textPrimary },

  actions: { gap: spacing.sm, marginTop: spacing.md },
  cancelButton: {},
  chargingTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  chargingTimerText: {
    ...typography.heading,
    color: colors.charging,
    fontWeight: '800',
  },
  reasonInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    maxHeight: 100,
  },

  /* ---- Success modal ---- */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
