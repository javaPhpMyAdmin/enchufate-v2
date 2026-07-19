/**
 * Auth group layout — owns the login / signup / reset flow.
 *
 * Wraps the three auth screens in a `Stack` so:
 *   - the user can navigate back from signup/reset to login via
 *     the OS back gesture (header is hidden, but the gesture works)
 *   - the auth group is independent of the 5-tab layout — Expo
 *     Router mounts it as a sibling so the tab bar is hidden.
 *
 * `screenOptions={{ headerShown: false }}` matches the root layout
 * so the visual language is consistent. The screens render their
 * own safe-area padding and brand mark.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
