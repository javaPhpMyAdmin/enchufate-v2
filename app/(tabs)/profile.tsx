/**
 * Perfil tab — Phase 5.
 *
 * Two states:
 *   - **Guest** (no session): illustrated empty state with a "CE"
 *     avatar placeholder, "Bienvenido" title, body copy, and two
 *     CTAs — "Iniciá sesión" (primary, full-width) and "Crear
 *     cuenta" (secondary, link-style). The CTA navigates to
 *     `/login?returnTo=/profile` and `/signup` respectively so the
 *     post-sign-in flow lands back here.
 *   - **Authenticated**: the full profile — avatar, display name,
 *     email, "Miembro desde {month} de {year}", three stat cards
 *     (Rating `0.0`, Reseñas `0`, Cargadores live count), the
 *     "Mis cargadores" section with a "Publicar nuevo" pill and a
 *     list of owned chargers, and a "Cerrar sesión" Button at the
 *     bottom.
 *
 * The three stat cards are a v2.1 placeholder for the ratings +
 * reviews system; only `Cargadores` is live (count from
 * `useMyChargers`). The 3-dot menu next to each charger in "Mis
 * cargadores" is rendered but disabled per the profile spec
 * (edit/delete ships in v2.1).
 */
import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  CalendarCheck,
  Star,
  Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { ChargerCard } from '@/components/molecules/ChargerCard';
import { ErrorState } from '@/components/molecules/ErrorState';
import { Icon } from '@/components/atoms/Icon';
import { LoadingState } from '@/components/molecules/LoadingState';
import { useSession } from '@/features/auth/hooks/useSession';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useMyChargers } from '@/features/profile/hooks/useMyChargers';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { colors, radius, spacing, typography } from '@/theme';

export default function ProfileTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, isLoading: sessionLoading } = useSession();
  const userId = session?.user.id ?? null;

  // While the session is hydrating we don't yet know which state to
  // render; show a spinner instead of flashing the guest empty
  // state and then swapping to the authed view.
  if (sessionLoading) {
    return <LoadingState />;
  }

  if (!session) {
    return <GuestState insetsTop={insets.top} insetsBottom={insets.bottom} />;
  }

  return (
    <AuthedState
      userId={userId ?? 'mock-uid'}
      insetsTop={insets.top}
      insetsBottom={insets.bottom}
      onPublishPress={() => router.push('/publish/1-name' as never)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Guest state                                                          */
/* ------------------------------------------------------------------ */

function GuestState({
  insetsTop,
  insetsBottom,
}: {
  insetsTop: number;
  insetsBottom: number;
}): React.JSX.Element {
  const router = useRouter();
  return (
    <View
      style={[
        styles.flex,
        styles.guest,
        { paddingTop: insetsTop + spacing.xl, paddingBottom: insetsBottom + spacing.xl },
      ]}
    >
      <View style={styles.ceAvatar}>
        <Text style={styles.ceInitials}>CE</Text>
      </View>
      <Text style={styles.guestTitle}>Bienvenido</Text>
      <Text style={styles.guestBody}>
        Iniciá sesión para gestionar tu cuenta, ver tus reservas y publicar tu cargador.
      </Text>
      <Button
        label="Iniciá sesión"
        variant="primary"
        fullWidth
        onPress={() => router.push('/login?returnTo=/profile' as never)}
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
/* Authenticated state                                                  */
/* ------------------------------------------------------------------ */

interface AuthedStateProps {
  userId: string;
  insetsTop: number;
  insetsBottom: number;
  onPublishPress: () => void;
}

function AuthedState({
  userId,
  insetsTop,
  insetsBottom,
  onPublishPress,
}: AuthedStateProps): React.JSX.Element {
  const profile = useProfile(userId);
  const myChargers = useMyChargers(userId);
  const signOut = useSignOut();

  const memberSince = useMemo(() => {
    if (!profile.data?.created_at) return null;
    // es-UY renders "marzo de 2024" — matches the spec scenario
    // "Miembro desde marzo de 2024" exactly.
    return new Intl.DateTimeFormat('es-UY', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(profile.data.created_at));
  }, [profile.data?.created_at]);

  if (profile.isLoading || myChargers.isLoading) {
    return <LoadingState />;
  }

  if (profile.error) {
    return (
      <ErrorState
        body={profile.error.userMessage}
        onRetry={() => profile.refetch()}
        retryLabel="Reintentar"
      />
    );
  }

  if (myChargers.error) {
    return (
      <ErrorState
        body={myChargers.error.userMessage}
        onRetry={() => myChargers.refetch()}
        retryLabel="Reintentar"
      />
    );
  }

  if (!profile.data) {
    return <LoadingState />;
  }

  const chargers = myChargers.data ?? [];
  const chargerCount = chargers.length;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insetsTop + spacing.lg, paddingBottom: insetsBottom + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity block */}
      <View style={styles.headerRow}>
        <Avatar
          uri={profile.data.avatar_url}
          name={profile.data.full_name ?? profile.data.email}
          size="lg"
        />
        <View style={styles.headerText}>
          <Text style={styles.displayName} numberOfLines={1}>
            {profile.data.full_name ?? 'Sin nombre'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {profile.data.email}
          </Text>
          {memberSince ? (
            <Text style={styles.memberSince}>Miembro desde {memberSince}</Text>
          ) : null}
        </View>
      </View>

      {/* Stat cards */}
      <View style={styles.statRow}>
        <StatCard icon={Star} value="0.0" label="Rating" />
        <StatCard icon={CalendarCheck} value="0" label="Reseñas" />
        <StatCard icon={Zap} value={String(chargerCount)} label="Cargadores" />
      </View>

      {/* Mis cargadores */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mis cargadores</Text>
          <PublishPill onPress={onPublishPress} />
        </View>

        {chargers.length === 0 ? (
          <Text style={styles.emptyHint}>Todavía no publicaste cargadores</Text>
        ) : (
          <View style={styles.chargerList}>
            {chargers.map((c) => (
              <View key={c.id} style={styles.chargerRow}>
                <ChargerCard
                  title={c.title}
                  address={c.address}
                  powerKw={c.power_kw}
                  status={c.status === 'active' ? 'disponible' : 'cancelada'}
                  style={styles.chargerCard}
                />
                <Button
                  label="⋯"
                  variant="ghost"
                  size="sm"
                  disabled
                  accessibilityLabel="Editar cargador (próximamente)"
                  onPress={() => undefined}
                  style={styles.chargerMenuButton}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Sign out */}
      <View style={styles.signOutWrap}>
        <Button
          label="Cerrar sesión"
          variant="secondary"
          fullWidth
          loading={signOut.isPending}
          onPress={() => signOut.signOut()}
        />
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Small helpers (kept inline so the file is self-contained)            */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}): React.JSX.Element {
  return (
    <Card variant="default" padding="md" style={styles.statCard}>
      <Icon icon={icon} size="lg" color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

function PublishPill({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Button
      label="+ Publicar nuevo"
      variant="secondary"
      size="sm"
      onPress={onPress}
      style={styles.publishPill}
    />
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
  ceAvatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  ceInitials: { ...typography.display, color: colors.primary, fontSize: 32, fontWeight: '700' },
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

  /* Authed */
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    gap: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  headerText: { flex: 1, gap: 2 },
  displayName: { ...typography.title, color: colors.textPrimary },
  email: { ...typography.caption, color: colors.textSecondary },
  memberSince: { ...typography.caption, color: colors.textSecondary },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.base },
  statValue: { ...typography.title, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary },

  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...typography.heading, color: colors.textPrimary },
  publishPill: { paddingHorizontal: spacing.md },
  emptyHint: { ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  chargerList: { gap: spacing.sm },
  chargerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chargerCard: { flex: 1 },
  chargerMenuButton: { minWidth: 44, paddingHorizontal: spacing.sm },

  signOutWrap: { marginTop: spacing.lg, paddingHorizontal: spacing.base },
});
