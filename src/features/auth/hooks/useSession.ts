/**
 * useSession — single source of truth for the current Supabase
 * session in React land.
 *
 * On mount, fetches the existing session (so the app restores auth
 * across cold starts), then subscribes to `onAuthStateChange` so
 * sign-in / sign-out / token-refresh events update React state in
 * real time. Every change is mirrored to `useAuthStore` so non-React
 * code (logger, network interceptors) can read the session via
 * `getCurrentUser()`.
 *
 * Returns the same shape regardless of whether the session is being
 * loaded for the first time or was already in memory: `{ session,
 * user, isLoading }`. `isLoading` is `true` only during the initial
 * `getSession()` call — after that, the listener fires synchronously
 * and the value never flips back to `true`.
 */
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { useAuthStore } from '../stores/authStore';
import type { AuthState } from '../types';

const INITIAL: AuthState = { session: null, user: null, isLoading: true };

/** Read the current session and listen for auth changes. */
export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>(INITIAL);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    let mounted = true;

    // Restore existing session on cold start. Supabase reads the
    // token from `secureStorage` (iOS Keychain / Android Encrypted-
    // SharedPreferences) and verifies it server-side. If verification
    // fails, `session` is `null` and we stay logged-out.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        const session = data.session;
        setSession(session);
        setState({ session, user: session?.user ?? null, isLoading: false });
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setState({ session: null, user: null, isLoading: false });
      });

    // Subscribe to live changes (sign-in, sign-out, token refresh).
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setState({ session, user: session?.user ?? null, isLoading: false });
      },
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [setSession]);

  return state;
}
