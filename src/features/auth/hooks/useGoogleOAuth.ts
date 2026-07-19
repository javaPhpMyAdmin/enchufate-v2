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
 *   3. On success, Supabase has already written the session to
 *      secure storage and `onAuthStateChange` fired — the user
 *      lands on the originating tab without us navigating.
 *   4. On user cancel (dismissed the Google picker), we surface
 *      a silent no-op so the screen returns to its idle state.
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
      const redirectTo = Linking.createURL('/(tabs)');

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
      // back into the app. The `result` only tells us the user
      // cancelled — a successful auth arrives via the auth-state
      // listener before this promise resolves, so we don't need to
      // parse a `result.url`.
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type === 'cancel' || result.type === 'dismiss') {
        // User dismissed the Google account picker. Spec says
        // "return to login with no error" — we throw a non-retryable
        // error that the screen can swallow (or render as a soft
        // "cancelaste el inicio de sesión" hint). v2.1 will likely
        // differentiate by status.
        throw new AppError({
          code: 'oauth_cancelled',
          message: 'User cancelled the Google OAuth flow',
          userMessage: 'Cancelaste el inicio de sesión con Google.',
          isAuthError: false,
          retryable: false,
        });
      }
    },
  });
}
