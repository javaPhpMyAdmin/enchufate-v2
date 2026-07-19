/**
 * Reservas tab — Phase 5.
 *
 * Two states:
 *   - **Guest** (no session): illustrated empty state with
 *     "Iniciá sesión" CTA. Same pattern as the other auth-gated
 *     tabs (Phase 4).
 *   - **Authenticated**: a segmented control with two tabs —
 *     "Mis reservas" (renter view) and "En mis cargadores" (host
 *     view) — each rendering a `FlatList` of `ReservationCard`s.
 *     The segmented control lives ABOVE the list; the list is
 *     keyed by the active tab so switching tabs resets the scroll
 *     position.
 *
 * Per the reservations spec scenario "Host sees the guest's name":
 * the renter view shows the host as the other party (the card
 * subtitle reads "Anfitrión: {host_name}"); the host view shows
 * the renter as the other party (the subtitle reads
 * "Huésped: {renter_name}"). The `otherParty()` helper in
 * `types.ts` picks the right participant from the current user.
 *
 * Tapping a card navigates to `/reservation/[id]`.
 */
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { CalendarCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/Button';
import { EmptyState } from '@/components/molecules/EmptyState';
import { ErrorState } from '@/components/molecules/ErrorState';
import { Icon } from '@/components/atoms/Icon';
import { LoadingState } from '@/components/molecules/LoadingState';
import { Skeleton } from '@/components/molecules/Skeleton';
import {
  ReservationCard,
  type ReservationRole as CardRole,
} from '@/components/molecules/ReservationCard';
import { useSession } from '@/features/auth/hooks/useSession';
import { useReservations } from '@/features/reservations/hooks/useReservations';
import { otherParty, timeBlock, type Reservation, type ReservationRole } from '@/features/reservations/types';
import { formatDateTime } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

type SegmentedTab = ReservationRole;

const SEGMENTS: ReadonlyArray<{ key: SegmentedTab; label: string }> = [
  { key: 'renter', label: 'Mis reservas' },
  { key: 'host', label: 'En mis cargadores' },
];

export default function ReservationsTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;

  if (sessionLoading) {
    return <LoadingState />;
  }

  if (!session) {
    return (
      <GuestState
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        onLoginPress={() => router.push('/login?returnTo=/reservations' as never)}
      />
    );
  }

  return <AuthedList userId={userId ?? 'mock-uid'} topInset={insets.top} />;
}

/* ------------------------------------------------------------------ */
/* Guest state                                                          */
/* ------------------------------------------------------------------ */

function GuestState({
  insetsTop,
  insetsBottom,
  onLoginPress,
}: {
  insetsTop: number;
  insetsBottom: number;
  onLoginPress: () => void;
}): React.JSX.Element {
  return (
    <View
      style={[
        styles.flex,
        styles.guest,
        { paddingTop: insetsTop + spacing.xl, paddingBottom: insetsBottom + spacing.xl },
      ]}
    >
      <View style={styles.guestIcon}>
        <Icon icon={CalendarCheck} size="xl" color={colors.primary} />
      </View>
      <Text style={styles.guestTitle}>Necesitás iniciar sesión</Text>
      <Text style={styles.guestBody}>
        Iniciá sesión para ver tus reservas y las reservas de tus cargadores.
      </Text>
      <Button
        label="Iniciá sesión"
        variant="primary"
        fullWidth
        onPress={onLoginPress}
        style={styles.guestCta}
      />
      <View style={styles.signupRow}>
        <Text style={styles.signupPrompt}>¿No tenés cuenta?</Text>
        <Link href="/signup" asChild>
          <Text style={styles.signupLink} accessibilityRole="link">
            Creá tu cuenta
          </Text>
        </Link>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Authenticated list                                                   */
/* ------------------------------------------------------------------ */

function AuthedList({
  userId,
  topInset,
}: {
  userId: string;
  topInset: number;
}): React.JSX.Element {
  const router = useRouter();
  const [tab, setTab] = useState<SegmentedTab>('renter');
  const reservations = useReservations(tab, userId);

  const renderContent = () => {
    if (reservations.isLoading) {
      return (
        <View style={styles.skeletonList}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonCardHeader}>
                <Skeleton width="40%" height={12} />
                <Skeleton width="20%" height={12} />
              </View>
              <Skeleton width="80%" height={18} style={styles.skeletonSpacerSm} />
              <Skeleton width="60%" height={12} style={styles.skeletonSpacerXs} />
              <View style={styles.skeletonCardFooter}>
                <Skeleton width="30%" height={12} />
                <Skeleton width="20%" height={12} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    if (reservations.error) {
      return (
        <ErrorState
          body={reservations.error.userMessage}
          onRetry={() => reservations.refetch()}
          retryLabel="Reintentar"
        />
      );
    }
    const list = reservations.data ?? [];
    if (list.length === 0) {
      return (
        <EmptyState
          icon={CalendarCheck}
          title={tab === 'renter' ? 'Todavía no tenés reservas' : 'Sin reservas en tus cargadores'}
          body={
            tab === 'renter'
              ? 'Cuando reserves un cargador, lo vas a ver acá.'
              : 'Cuando alguien reserve uno de tus cargadores, lo vas a ver acá.'
          }
        />
      );
    }
    return (
      <FlatList
        key={tab}
        data={list}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <ReservationRow
            reservation={item}
            role={tab}
            currentUserId={userId}
            onPress={() => router.push(`/reservation/${item.id}` as never)}
          />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    );
  };

  return (
    <View style={[styles.flex, { paddingTop: topInset }]}>
      <View style={styles.segmentedWrap}>
        <SegmentedControl
          options={SEGMENTS}
          value={tab}
          onChange={setTab}
        />
      </View>
      {renderContent()}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Reservation row                                                      */
/* ------------------------------------------------------------------ */

function ReservationRow({
  reservation,
  role,
  currentUserId,
  onPress,
}: {
  reservation: Reservation;
  role: CardRole;
  currentUserId: string;
  onPress: () => void;
}): React.JSX.Element {
  const party = otherParty(reservation, currentUserId);
  const time = timeBlock(reservation);
  // ReservationCard's expected `status` is the StatusPillKind, which
  // is a superset of ReservationStatus (it also includes 'disponible').
  return (
    <ReservationCard
      status={reservation.status}
      chargerTitle={reservation.charger_title}
      address={reservation.charger_address}
      timeBlock={time}
      powerKw={reservation.charger_power_kw}
      otherPartyName={party.name}
      otherPartyAvatarUri={party.avatarUrl}
      role={role}
      onPress={onPress}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control (inline; small enough to skip a new atom)          */
/* ------------------------------------------------------------------ */

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}): React.JSX.Element {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            style={[styles.segment, selected ? styles.segmentSelected : null]}
          >
            <Text
              style={[
                styles.segmentText,
                selected ? styles.segmentTextSelected : null,
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },

  /* Guest */
  guest: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  guestIcon: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  guestTitle: { ...typography.title, color: colors.textPrimary, textAlign: 'center' },
  guestBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  guestCta: { marginTop: spacing.base, alignSelf: 'stretch' },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  signupPrompt: { ...typography.caption, color: colors.textSecondary },
  signupLink: { ...typography.caption, color: colors.primary, fontWeight: '600' },

  segmentedWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.sm },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },
  segmentTextSelected: { color: colors.textOnPrimary },

  list: { padding: spacing.base, gap: spacing.sm },
  separator: { height: spacing.sm },

  // ----- Skeleton (loading) -----
  skeletonList: { padding: spacing.base, gap: spacing.sm },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  skeletonCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  skeletonCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  skeletonSpacerSm: { marginTop: spacing.sm },
  skeletonSpacerXs: { marginTop: spacing.xs },
});
