/**
 * Root layout — Expo Router 6 entry point.
 *
 * Provider tree (outer → inner):
 *   1. `GestureHandlerRootView` — required by `react-native-gesture-handler`
 *      for any gesture-based UI (map pan, bottom sheet swipe, drawer).
 *      Must wrap the entire tree so gestures register on first mount.
 *   2. `QueryClientProvider` — TanStack Query cache. The single source
 *      of truth for server state; every feature hook reads/writes here.
 *   3. `SafeAreaProvider` — feeds `useSafeAreaInsets()` to all screens
 *      so Inicio, Mapa, and the auth group can pad their content.
 *   4. `BottomSheetModalProvider` — required by `@gorhom/bottom-sheet`
 *      so the Filtros sheet on the Mapa tab can present/dismiss.
 *   5. `useSession()` — mounted here (not in a screen) so the
 *      `onAuthStateChange` subscription is alive for the entire
 *      lifetime of the app. Any sign-in / sign-out / token refresh
 *      event propagates to `useAuthStore` and to every screen that
 *      reads `useSession()`. Rendering the hook's return value is
 *      a no-op (`null`); we only need the side effects.
 *   6. `Stack` — Expo Router's navigator. The Stack auto-discovers
 *      every file under `app/` (the 5-tab `(tabs)` group is wired in
 *      `app/(tabs)/_layout.tsx`; the auth flow is in `app/(auth)/`).
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useSession } from '@/features/auth/hooks/useSession';
import { queryClient } from '@/lib/queryClient';

export default function RootLayout() {
  // Mounted for its side effects (subscribes to onAuthStateChange,
  // hydrates the auth store). The returned state is consumed by
  // individual screens, not the layout.
  useSession();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
