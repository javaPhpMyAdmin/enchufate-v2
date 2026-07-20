/**
 * useGoogleOAuth — sign in with Google via the web flow.
 *
 * **Why web, not native?** Per `design.md §7.4`, MVP uses the
 * Supabase web OAuth flow through `expo-web-browser` instead of
 * `@react-native-google-signin/google-signin`. The trade-off is
 * ~1s of system-browser overhead in exchange for zero native
 * config (no GoogleService-Info.plist, no Firebase project, no
 * `google-services.json`). v2.1 will add native one-tap sign-in.
 *
 * **Flow**:
 *   1. `supabase.auth.signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })`
 *      returns a URL the user must visit.
 *   2. We open that URL in `expo-web-browser.openAuthSessionAsync`
 *      with the deep-link `redirectTo` so the OS bounces the user
 *      back into the app after they authenticate.
 *   3. On success, we parse the redirect URL for either a PKCE code
 *      (?code=...) or implicit tokens (#access_token=...&refresh_token=...)
 *      and create the session. This triggers `onAuthStateChange` so
 *      the login screen's useEffect redirects to /(tabs).
 *   4. On user cancel (dismissed the Google picker), we surface
 *      a silent no-op so the screen returns to its idle state.
 *
 * **Android note**: The deep-link redirect may restart the app
 * instead of returning to `openAuthSessionAsync`. In that case the
 * promise never resolves — the session is created by the boot-time
 * deep-link handler in `useSession.ts` instead.
 */
import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

export interface UseGoogleOAuthResult {
  mutate: () => void;
  isPending: boolean;
  error: AppError | null;
  reset: () => void;
}

/**
 * Pre-warms the browser on iOS. `expo-web-browser` documents that
 * calling this on mount cuts ~100ms off the first `openAuthSession
 * Async` call. Mounted once from the login screen — no need to
 * repeat.
 */
WebBrowser.maybeCompleteAuthSession();

/** Trigger the Google OAuth flow. The session is set via onAuthStateChange. */
export function useGoogleOAuth(): UseGoogleOAuthResult {
  return useMutation<void, AppError, void>({
    mutationFn: async () => {
      // Use the same deep-link URL the rest of the app uses so the
      // OS handles the redirect consistently.
      const redirectTo = 'enchufate://(tabs)';

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // Don't let Supabase auto-redirect — we want the URL back
          // so we can hand it to `openAuthSessionAsync`, which gives
          // us a proper in-app browser with a close button instead
          // of dumping the user into Safari.
          skipBrowserRedirect: true,
        },
      });
      if (error) throw normalizeSupabaseError(error);
      if (!data?.url) {
        throw new AppError({
          code: 'oauth_no_url',
          message: 'Supabase did not return an OAuth URL',
          userMessage: 'No pudimos iniciar sesión con Google. Probá de nuevo.',
          retryable: true,
        });
      }

      // `openAuthSessionAsync` blocks until the user dismisses the
      // browser, completes the OAuth flow, or the deep link fires
      // back into the app. On Android the deep link may restart the
      // app, so this promise may never resolve — that's fine because
      // `useSession` handles the redirect URL on boot.
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type === 'cancel' || result.type === 'dismiss') {
        throw new AppError({
          code: 'oauth_cancelled',
          message: 'User cancelled the Google OAuth flow',
          userMessage: 'Cancelaste el inicio de sesión con Google.',
          isAuthError: false,
          retryable: false,
        });
      }

      if (result.type === 'success') {
        // The redirect URL carries auth data in one of two formats:
        //   PKCE:  ?code=<authorization_code>  → exchange for session
        //   Implicit: #access_token=...&refresh_token=... → set directly
        // We handle both because Supabase may be configured for either.
        const url = new URL(result.url);

        // --- PKCE flow ---
        const code = url.searchParams.get('code');
        if (code) {
          // eslint-disable-next-line no-console
          console.warn('[useGoogleOAuth] PKCE code received, exchanging...');
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw normalizeSupabaseError(exchangeError);
          return; // ← session created, onAuthStateChange will fire
        }

        // --- Implicit flow (hash fragment) ---
        const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          // eslint-disable-next-line no-console
          console.warn(
            '[useGoogleOAuth] Implicit tokens received, setting session...',
          );
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw normalizeSupabaseError(sessionError);
          return; // ← session created, onAuthStateChange will fire
        }

        // If we reach here, the redirect URL had no auth data.
        // On Android this can happen when the deep link restarts the
        // app and openAuthSessionAsync returns a partial URL — the
        // real session is created by useSession's boot-time handler.
        // eslint-disable-next-line no-console
        console.warn(
          '[useGoogleOAuth] Success result but no tokens in URL — ' +
            'session may be handled by boot-time deep link handler. URL: ' +
            result.url.slice(0, 120),
        );
      }
    },
  });
}
