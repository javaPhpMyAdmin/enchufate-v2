/**
 * useSignIn — email + password sign-in mutation.
 *
 * Built on TanStack Query's `useMutation` so the loading + error
 * state integrates with the rest of the app's data layer (no
 * parallel `useState`/`isLoading` patterns). The submit is
 * debounced 800ms via `useDebouncedMutation` to prevent rapid
 * double-taps from spamming Supabase Auth.
 *
 * The mutation function normalizes every error to `AppError` via
 * `normalizeSupabaseError` so the UI reads `error.userMessage` and
 * `error.isNetworkError` directly — no raw `Error.message` ever
 * reaches the screen.
 *
 * If Supabase returns no error but also no session, the user is
 * most likely unverified (Supabase's default for new sign-ups).
 * We surface a typed `email_not_verified` error so the screen
 * can show "Verificá tu correo para iniciar sesión".
 */
import { useMutation } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

import type { Session } from '../types';
import { useDebouncedMutation } from './_debounce';

export interface SignInInput {
  email: string;
  password: string;
}

export interface UseSignInResult {
  mutate: (input: SignInInput) => void;
  isPending: boolean;
  error: AppError | null;
  /** Resets the error so the next submit shows a fresh UI state. */
  reset: () => void;
}

/** Sign in with email + password. Debounced 800ms after submit. */
export function useSignIn(): UseSignInResult {
  const mutation = useMutation<Session, AppError, SignInInput>({
    mutationFn: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw normalizeSupabaseError(error);
      if (!data.session) {
        throw new AppError({
          code: 'email_not_verified',
          message: 'Email not verified',
          userMessage: 'Verificá tu correo para iniciar sesión',
          isAuthError: true,
          retryable: false,
        });
      }
      return data.session;
    },
  });

  return useDebouncedMutation(mutation) as UseSignInResult;
}
