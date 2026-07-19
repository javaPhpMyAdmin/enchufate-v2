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
 * **OAuth deep-link handler**: On Android, the OAuth redirect
 * (`enchufate:///(tabs)?code=...`) restarts the app. We detect the
 * initial URL on boot, extract the PKCE code or implicit tokens,
 * and create the session before `getSession()` runs. This ensures
 * the redirect doesn't silently drop the auth.
 *
 * Returns the same shape regardless of whether the session is being
 * loaded for the first time or was already in memory: `{ session,
 * user, isLoading }`. `isLoading` is `true` only during the initial
 * `getSession()` call — after that, the listener fires synchronously
 * and the value never flips back to `true`.
 */
import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

import { useAuthStore } from '../stores/authStore';
import type { AuthState } from '../types';

const INITIAL: AuthState = { session: null, user: null, isLoading: true };

/**
 * Check if the app was opened via an OAuth deep link and create the
 * session. Returns after processing (or immediately if no auth URL).
 */
async function handleOAuthDeepLink(): Promise<void> {
  let url: string | null;
  try {
    url = await Linking.getInitialURL();
  } catch {
    return; // No initial URL — normal cold start
  }
  if (!url) return;

  try {
    const parsed = new URL(url);

    // --- PKCE flow: ?code=... ---
    const code = parsed.searchParams.get('code');
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
      return;
    }

    // --- Implicit flow: #access_token=...&refresh_token=... ---
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  } catch {
    // Not a valid URL or other parsing error — fall through to getSession
  }
}

/** Read the current session and listen for auth changes. */
export function useSession(): AuthState {
  const [state, setState] = useState<AuthState>(INITIAL);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    let mounted = true;

    // 1. Handle OAuth deep link FIRST (Android restart case).
    //    This creates the session from the redirect URL before we
    //    call getSession(), so the session is already there.
    // 2. Then restore any existing session (cold start / warm boot).
    // 3. Then subscribe to live changes.
    void handleOAuthDeepLink()
      .catch(() => {}) // best-effort — if it fails, we fall through to getSession
      .then(() => {
        if (!mounted) return;
        return supabase.auth
          .getSession()
          .then(({ data }) => {
            if (!mounted) return;
            const session = data.session;
            setSession(session);
            setState({ session, user: session?.user ?? null, isLoading: false });
          });
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
