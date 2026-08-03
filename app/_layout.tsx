/**
 * Root layout — Expo Router 6 entry point.
 *
 * Provider tree (outer → inner):
 *   1. `GestureHandlerRootView` — required by `react-native-gesture-handler`
 *      for any gesture-based UI (map pan, bottom sheet swipe, drawer).
 *      Must wrap the entire tree so gestures register on first mount.
 *   2. `ErrorBoundary` (Phase 8) — class-based render-error catch.
 *      Every screen below is protected; a thrown render error surfaces
 *      as a friendly `<ErrorState />` with a "Reintentar" Button instead
 *      of crashing the app. Sentry is deferred to v2.1.
 *   3. `QueryClientProvider` — TanStack Query cache. The single source
 *      of truth for server state; every feature hook reads/writes here.
 *   4. `SafeAreaProvider` — feeds `useSafeAreaInsets()` to all screens
 *      so Inicio, Mapa, and the auth group can pad their content.
 *   5. `BottomSheetModalProvider` — required by `@gorhom/bottom-sheet`
 *      so the Filtros sheet on the Mapa tab can present/dismiss.
 *   6. `useSession()` — mounted here (not in a screen) so the
 *      `onAuthStateChange` subscription is alive for the entire
 *      lifetime of the app. Any sign-in / sign-out / token refresh
 *      event propagates to `useAuthStore` and to every screen that
 *      reads `useSession()`. Rendering the hook's return value is
 *      a no-op (`null`); we only need the side effects.
 *   7. `Stack` — Expo Router's navigator. The Stack auto-discovers
 *      every file under `app/` (the 5-tab `(tabs)` group is wired in
 *      `app/(tabs)/_layout.tsx`; the auth flow is in `app/(auth)/`).
 *
 * **Boot side effects** (Phase 8 polish, runs once on mount):
 *   - **Asset preloading** — `home_card.png` (Inicio hero) and
 *     `cargador.png` (map pin) are downloaded into the Expo asset
 *     cache so first paint of the Inicio + Mapa screens skips the
 *     decode round-trip. Idempotent on warm boots.
 *   - **Feature flag log** — dumps the current `FEATURES` map to the
 *     console so a developer can confirm the right flags are on for
 *     the build. The actual gating happens in each feature hook
 *     (`isFeatureEnabled('CHAT')` etc.) per the no-React-Context rule.
 *  - **Query persister** — mirrors the TanStack Query cache into
 *     `AsyncStorage` for 24h so the messaging / reservation lists
 *     rehydrate on the first render after a cold start. The persister
 *     lives in `src/lib/queryPersister.ts`; the wiring is the only
 *     line of code the layout owns.
 *  - **Push response listener** — taps on reservation pushes
 *     navigate to `/reservation/[id]` (warm + cold start). Wired
 *     here next to `useRegisterPushToken`; both are gated by
 *     `PUSH_NOTIFICATIONS`.
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { Asset } from 'expo-asset';
import * as Notifications from 'expo-notifications';
import { Stack, router, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/molecules/ErrorBoundary';
import { useSession } from '@/features/auth/hooks/useSession';
import { useRegisterPushToken } from '@/features/auth/hooks/useRegisterPushToken';
import { FEATURES, isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import {
  QUERY_CACHE_MAX_AGE_MS,
  asyncStoragePersister,
} from '@/lib/queryPersister';

export default function RootLayout() {
  // Mounted for its side effects (subscribes to onAuthStateChange,
  // hydrates the auth store). The returned state is consumed by
  // individual screens, not the layout.
  useSession();
  useRegisterPushToken();

  // Readiness signal for the push-response handlers below. The
  // imperative `router.push` throws "Attempted to navigate before
  // mounting the Root Layout component" when the NavigationContainer
  // is not ready yet (iOS cold start from a notification tap).
  // `useRootNavigationState` is NOT usable here — it resolves the
  // internal `__root` slot via `getParent`, which only exists from
  // screens, so it throws in the layout itself. The container ref is
  // the layout-safe equivalent of the exact check `router.push`
  // performs (`navigationRef.isReady()`).
  const navigationRef = useNavigationContainerRef();

  // ----- Push response listener (notification deep links) -----
  // Registered once at the root layout — the same lifecycle as the
  // push token registration. Tapping a reservation push navigates to
  // `/reservation/[id]` using the `data` payload sent by `send-push`
  // (`{ type: 'reservation', reservationId }`). Gated by the same
  // feature flag that gates token registration.
  useEffect(() => {
    if (!isFeatureEnabled('PUSH_NOTIFICATIONS')) return;

    // Dedupe: iOS can deliver the SAME launch response both through
    // `getLastNotificationResponse()` (cold start) and through the
    // listener (if the listener registered before the tap landed).
    // Keying on the request identifier makes the second delivery a
    // no-op.
    const handledIds = new Set<string>();

    // Navigate with a readiness gate + backoff. `router.push` throws
    // when the NavigationContainer is not ready (cold start on iOS:
    // the response is read at layout mount, before the navigator has
    // committed its initial state). We retry up to 3 times ~400ms
    // apart; if the navigator never becomes ready we give up
    // gracefully — the caller clears the stored response either way,
    // so a later remount never re-navigates.
    const navigateToReservation = (
      reservationId: string,
      attemptsLeft: number,
    ): void => {
      if (navigationRef.current == null) {
        if (attemptsLeft > 0) {
          setTimeout(
            () => navigateToReservation(reservationId, attemptsLeft - 1),
            400,
          );
        }
        return;
      }
      try {
        router.push({
          pathname: '/reservation/[id]',
          params: { id: reservationId },
        });
      } catch (err) {
        // The ref gate covers the common case; this catches the
        // residual race where `isReady()` is still false while the
        // container ref is set. Same backoff, then drop.
        if (attemptsLeft > 0) {
          setTimeout(
            () => navigateToReservation(reservationId, attemptsLeft - 1),
            400,
          );
        } else {
          // eslint-disable-next-line no-console
          console.warn('[push] failed to navigate to reservation', err);
        }
      }
    };

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      if (
        data?.type === 'reservation' &&
        typeof data.reservationId === 'string'
      ) {
        const requestId = response.notification.request.identifier;
        if (handledIds.has(requestId)) return;
        handledIds.add(requestId);
        try {
          navigateToReservation(data.reservationId, 3);
        } finally {
          // Always consume the stored response — a later remount
          // (e.g. HMR) or re-delivery must not re-navigate to the
          // same reservation.
          Notifications.clearLastNotificationResponse();
        }
      }
    };

    // Cold start: when the app is launched from a notification tap
    // the response is not re-delivered to the listener, so read the
    // last one. `handleResponse` clears it in its finally block.
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      handleResponse(lastResponse);
    }

    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      subscription.remove();
    };
  }, []);

  // ----- Boot side effects (Phase 8 polish) -----
  useEffect(() => {
    let cancelled = false;

    // 1. Asset preloading — home hero + map pin. Best-effort; the
    //    screens still render via `require()` if the cache write
    //    fails (e.g. on a flaky network at first boot).
    void Promise.all([
      Asset.fromModule(require('@/../assets/images/home_card.png')).downloadAsync(),
      Asset.fromModule(require('@/../assets/icons/cargador.png')).downloadAsync(),
    ]).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn('[boot] asset preload failed', err);
    });

    // 2. Feature flag log — surfaces the active feature set to the
    //    dev console. The real gating is in each feature hook; this
    //    is purely for visibility at boot. Wired at the provider
    //    tree (this layout) per the Phase 3 follow-up.
    if (!cancelled) {
      // eslint-disable-next-line no-console
      console.info(
        '[boot] feature flags',
        Object.fromEntries(
          (Object.keys(FEATURES) as Array<keyof typeof FEATURES>).map((k) => [
            k,
            isFeatureEnabled(k),
          ]),
        ),
      );
    }

    // 3. Query persister — hydrate the cache on boot, then keep it
    //    in sync for 24h. The teardown function (first element of
    //    the tuple) is called on layout unmount — which never
    //    happens in practice (the layout lives for the whole app)
    //    but is wired for completeness so HMR can re-run the effect
    //    without leaking the previous subscription.
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister: asyncStoragePersister,
      maxAge: QUERY_CACHE_MAX_AGE_MS,
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <BottomSheetModalProvider>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }} />
            </BottomSheetModalProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
