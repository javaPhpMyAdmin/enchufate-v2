/**
 * Root layout — Expo Router 6 entry point.
 *
 * Phase 1 skeleton: just renders a Stack. The full provider tree
 * (GestureHandlerRootView, QueryClientProvider, SafeAreaProvider,
 * AuthProvider, BottomSheetModalProvider) lands in Phase 3 once the
 * queryClient, auth hooks, and bottom-sheet deps are installed.
 *
 * Header is hidden by default — each tab owns its own header if
 * needed, and the auth flow uses full-screen modals.
 */
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
