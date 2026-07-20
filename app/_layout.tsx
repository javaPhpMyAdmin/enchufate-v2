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
 *   - **Query persister** — mirrors the TanStack Query cache into
 *     `AsyncStorage` for 24h so the messaging / reservation lists
 *     rehydrate on the first render after a cold start. The persister
 *     lives in `src/lib/queryPersister.ts`; the wiring is the only
 *     line of code the layout owns.
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/molecules/ErrorBoundary';
import { useSession } from '@/features/auth/hooks/useSession';
import { FEATURES, isFeatureEnabled } from '@/lib/features';
import { queryClient } from '@/lib/queryClient';
import {
  QUERY_CACHE_MAX_AGE_MS,
  asyncStoragePersister,
} from '@/lib/queryPersister';
import { initMapbox } from '@/lib/mapbox';

export default function RootLayout() {
  // Mounted for its side effects (subscribes to onAuthStateChange,
  // hydrates the auth store). The returned state is consumed by
  // individual screens, not the layout.
  useSession();

  // ----- Boot side effects (Phase 8 polish) -----
  useEffect(() => {
    let cancelled = false;

    // 0. MapBox init — must run after mount so the native bridge is
    //    ready. Idempotent; safe to call on every mount.
    initMapbox();

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
