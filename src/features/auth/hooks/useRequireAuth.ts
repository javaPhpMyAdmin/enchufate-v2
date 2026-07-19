/**
 * useRequireAuth — auth gate for screens that REQUIRE a session.
 *
 * Wraps `useSession()` and exposes a `requireAuth()` callback the
 * screen calls (typically from a CTA) to bounce the user to
 * `/login?returnTo=<path>` when the session is missing. We don't
 * auto-redirect on mount because the screen needs to render its
 * EmptyState first (so the user sees the "Iniciá sesión" prompt
 * before being navigated away).
 *
 * Pass `returnTo` when calling `requireAuth()` — this MUST be one
 * of the allow-listed paths (`allowList.isAllowedReturnTo`).
 * Invalid paths fall back to `/(tabs)` (the home tab) so a typo
 * in the deep link doesn't strand the user on a 404.
 */
import { useCallback } from 'react';
import { router } from 'expo-router';

import { isAllowedReturnTo } from '../allowList';
import { useSession } from './useSession';

export interface RequireAuthResult {
  isAuthenticated: boolean;
  isLoading: boolean;
  /**
   * Navigate to the login screen with a validated `returnTo`. If
   * `path` is not on the allow-list, falls back to `/(tabs)`.
   */
  requireAuth: (path?: string) => void;
}

const FALLBACK = '/(tabs)';

/** Returns the auth gate result + a `requireAuth` navigation helper. */
export function useRequireAuth(): RequireAuthResult {
  const { session, isLoading } = useSession();

  const requireAuth = useCallback((path?: string) => {
    const target = path && isAllowedReturnTo(path) ? path : FALLBACK;
    router.push(`/login?returnTo=${encodeURIComponent(target)}` as never);
  }, []);

  return { isAuthenticated: session !== null, isLoading, requireAuth };
}
