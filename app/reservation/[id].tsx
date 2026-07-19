/**
 * Reservation detail — `/reservation/[id]`.
 *
 * One state (the screen is only reachable when the user is signed
 * in and the reservation exists). Renders the full reservation:
 *   - Charger info card (title, address, connector + power, price)
 *   - Other-party block (avatar + name + role label)
 *   - Time block (structured start_at – end_at OR the
 *     `horario_a_coordinar` free-text)
 *   - Status pill
 *   - "Cómo llegar" link → opens the charger location in the
 *     system browser with a Google Maps URL
 *   - "Chatear" Button → navigates to the paired conversation
 *     thread at `/messages/[conversation_id]`
 *   - "Cancelar reserva" Button (only when `isCancellable(status)`
 *     is true) → shows a confirm dialog and (for Phase 5) a
 *     no-op handler. The actual cancel mutation lands in Phase 7
 *     with the `system-message-injector` Edge Function wiring.
 *
 * The cancel confirm copy is the spec-required "¿Cancelar la
 * reserva de Cargador {title}?" with two actions. For Phase 5
 * the "Cancelar y volver" action shows a brief "Función
 * próximamente" toast via `Alert.alert` because the real
 * `useCancelReservation` mutation lands in Phase 7. The
 * `ConfirmModal` atom (Phase 2 deferred) will replace this in
 * Phase 7 as well.
 */
import { useCallback } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowUpRight,
  Calendar,
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
import { ErrorState } from '@/components/molecules/ErrorState';
import { LoadingState } from '@/components/molecules/LoadingState';
import { useSession } from '@/features/auth/hooks/useSession';
import { useReservation } from '@/features/reservations/hooks/useReservation';
import {
  isCancellable,
  otherParty,
  timeBlock,
  type ReservationStatus,
} from '@/features/reservations/types';
import { colors, radius, spacing, typography } from '@/theme';

export default function ReservationDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const reservationId = typeof params.id === 'string' ? params.id : null;

  const { session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;
  const reservation = useReservation(reservationId);

  const onCancel = useCallback(() => {
    if (!reservation.data) return;
    const title = `¿Cancelar la reserva de ${reservation.data.charger_title}?`;
    const message = 'Esta acción no se puede deshacer.';
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cancelar y volver',
        style: 'destructive',
        // Phase 5 mock — the real mutation lands in Phase 7 with
        // the system-message-injector Edge Function wiring.
        onPress: () => {
          Alert.alert(
            'Función próximamente',
            'La cancelación real llega con la siguiente entrega del MVP.',
          );
        },
      },
    ]);
  }, [reservation.data]);

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
              {r.charger_address}
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

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="Chatear"
            variant="primary"
            fullWidth
            leftIcon={<Icon icon={MessageCircle} size="md" color={colors.textOnPrimary} />}
            onPress={onChat}
          />
          {isCancellable(r.status as ReservationStatus) ? (
            <Button
              label="Cancelar reserva"
              variant="danger"
              fullWidth
              onPress={onCancel}
              style={styles.cancelButton}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function formatPower(kw: number): string {
  return `${kw.toFixed(kw % 1 === 0 ? 0 : 1)} kW`;
}

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

  actions: { gap: spacing.sm, marginTop: spacing.md },
  cancelButton: {},
});
