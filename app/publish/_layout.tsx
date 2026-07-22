/**
 * Publish wizard layout — `/publish/*`.
 *
 * Four concerns in this layout:
 *   1. **Auth gate** — every publish screen is auth-required. The
 *      layout reads `useSession()`; if there's no session and the
 *      initial hydration has finished, we redirect to
 *      `/login?returnTo=/publish/1-name` (the route is on the
 *      `allowList` from Phase 3, so the login screen accepts it).
 *   2. **Step → route sync** — the `usePublishStore.step` counter
 *      drives the progress bar in `PublishWizardNav`. When the
 *      user taps "Siguiente" or "Atrás", the nav mutates `step`;
 *      this layout's `useEffect` watches `step` and navigates to
 *      the matching `/publish/N-{name}` route so the Stack
 *      renders the right screen.
 *   3. **Pinned chrome** — the `BetaBanner` lives at the top and
 *      the `PublishWizardNav` lives at the bottom of every step.
 *      The screen renders only the form content in between.
 *   4. **Exit guard** (Phase 8 polish) — a hardware back press
 *      while the wizard has unsaved data (any non-default field
 *      populated) pops an `Alert.alert` confirmation. The user
 *      can either "Seguir publicando" (cancel) or "Salir" which
 *      calls `publishStore.resetWizard()` and replaces the
 *      stack with `/(tabs)`. The OS-level back button is the
 *      only reliable hook here; the iOS swipe-back gesture is
 *      a known limitation that's documented in the spec.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BetaBanner } from '@/components/atoms/BetaBanner';
import { PublishWizardNav } from '@/components/organisms/PublishWizardNav';
import { useSession } from '@/features/auth/hooks/useSession';
import { usePublishStore, type PublishStep } from '@/stores/publishStore';
import { colors, spacing } from '@/theme';

/** Map of step number → the route Expo Router should render. */
const STEP_ROUTE: Record<PublishStep, string> = {
  1: '/publish/1-name',
  2: '/publish/2-location',
  3: '/publish/3-connector',
  4: '/publish/4-photos',
  5: '/publish/5-pricing',
  6: '/publish/6-schedule',
  7: '/publish/7-rules',
};

/**
 * Pure check: does the wizard have any user-typed data worth
 * protecting? The `name` / `description` / `address` / `rules`
 * strings and the `photos` array are the load-bearing fields;
 * `step` itself is irrelevant (a user starting fresh is on
 * step 1 with empty data and gets a free exit).
 */
function hasUnsavedChanges(s: ReturnType<typeof usePublishStore.getState>): boolean {
  if (s.name.trim().length > 0) return true;
  if (s.description.trim().length > 0) return true;
  if (s.location && (s.location.address.trim().length > 0 || s.location.lat !== null)) {
    return true;
  }
  if (s.connector_type !== null) return true;
  if (s.power_kw !== null) return true;
  if (s.photos.length > 0) return true;
  if (s.pricing.price_per_hour_usd !== null) return true;
  if (s.rules.trim().length > 0) return true;
  return false;
}

export default function PublishLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useSession();
  const step = usePublishStore((s) => s.step);
  const setStep = usePublishStore((s) => s.setStep);
  const resetWizard = usePublishStore((s) => s.resetWizard);

  // ----- Auth gate -----
  // Redirect to login as soon as we know the user is logged out.
  // While the session is hydrating (isLoading) we render a
  // spinner so the layout doesn't flash.
  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace('/login?returnTo=/publish/1-name' as never);
    }
  }, [session, isLoading, router]);

  // ----- Step ↔ route sync -----
  // Two effects with a guard to prevent ping-pong:
  //   - Step → route: when nextStep/prevStep changes `step`, navigate.
  //   - Route → step: when deep-link changes `pathname`, sync step.
  // The guard (navigatingFromStepRef) tells route→step to skip
  // when the pathname change was caused by step→route navigation.
  const navigatingFromStepRef = useRef(false);

  // Step → route: navigate when the store's step changes
  useEffect(() => {
    const expected = STEP_ROUTE[step];
    if (expected && pathname !== expected) {
      navigatingFromStepRef.current = true;
      router.replace(expected as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Route → step: sync step from pathname (for deep links)
  useEffect(() => {
    if (navigatingFromStepRef.current) {
      navigatingFromStepRef.current = false;
      return;
    }
    const entry = Object.entries(STEP_ROUTE).find(([, r]) => r === pathname);
    if (entry) {
      const routeStep = Number(entry[0]) as PublishStep;
      if (routeStep !== step) setStep(routeStep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ----- Exit guard (Phase 8 polish) -----
  // Hardware back press on Android (and on iOS hardware-keyboard
  // devices) — show an alert if the user has unsaved data. The
  // iOS swipe-back gesture is not intercepted here (Expo Router
  // does not expose a `beforeRemove` API as of SDK 54); the
  // back button is the reliable hook for the MVP.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const state = usePublishStore.getState();
      if (!hasUnsavedChanges(state)) {
        // Clean exit — no alert, let the OS navigate.
        return false;
      }
      Alert.alert(
        'Tenés cambios sin guardar',
        'Si salís ahora vas a perder el cargador que estás publicando.',
        [
          { text: 'Seguir publicando', style: 'cancel' },
          {
            text: 'Salir',
            style: 'destructive',
            onPress: () => {
              state.resetWizard();
              router.replace('/(tabs)' as never);
            },
          },
        ],
        { cancelable: true },
      );
      // Consume the event so the OS does not also navigate back.
      return true;
    });
    return () => sub.remove();
  }, [router, resetWizard]);

  if (isLoading || !session) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.banner, { paddingTop: insets.top + spacing.sm }]}>
        <BetaBanner />
      </View>
      <View style={styles.stack}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <PublishWizardNav />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  banner: {
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stack: { flex: 1 },
});
