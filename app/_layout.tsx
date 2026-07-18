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
 *   5. `Stack` — Expo Router's navigator. The Stack auto-discovers
 *      every file under `app/` (the 5-tab `(tabs)` group is wired in
 *      `app/(tabs)/_layout.tsx`).
 *
 * The `AuthProvider` lands in Phase 3 alongside the auth hooks; the
 * session shadow lives in `@/stores/authStore` and the per-tab gates
 * already render their `EmptyState` with an "Iniciá sesión" CTA until
 * Phase 3 swaps in `useSession`.
 */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/queryClient';

export default function RootLayout() {
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
