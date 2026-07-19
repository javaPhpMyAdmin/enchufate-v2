/**
 * Publish wizard layout — `/publish/*`.
 *
 * Three concerns in this layout:
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
 *
 * PR-B ships steps 1 and 2. Tapping "Siguiente" on step 2 calls
 * `nextStep()` which sets `step = 3`; the layout's useEffect then
 * navigates to `/publish/3-connector`, which is a 404 in PR-B. PR-C
 * adds that route. The intermediate 404 is expected and is the
 * reviewable unit boundary.
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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

export default function PublishLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading } = useSession();
  const step = usePublishStore((s) => s.step);
  const setStep = usePublishStore((s) => s.setStep);

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

  // ----- Step → route sync -----
  // When the user taps Siguiente / Atrás, the store mutates `step`
  // and this effect pushes the matching route. Conversely, if the
  // user deep-links to /publish/2-location directly, we sync the
  // store's `step` to the route so the progress bar is correct.
  useEffect(() => {
    const entry = Object.entries(STEP_ROUTE).find(([, route]) => route === pathname);
    if (entry) {
      const [stepStr] = entry;
      const routeStep = Number(stepStr) as PublishStep;
      if (routeStep !== step) setStep(routeStep);
      return;
    }
    // Pathname doesn't match a known step (e.g. before the user
    // lands on a step route). Snap to the current store step.
    const expected = STEP_ROUTE[step];
    if (expected && pathname !== expected) {
      router.replace(expected as never);
    }
  }, [pathname, step, setStep, router]);

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
