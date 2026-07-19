/**
 * useResetPassword — send a password-reset email.
 *
 * Calls `supabase.auth.resetPasswordForEmail()` with a `redirectTo`
 * that lands the user on the (future) `/reset-callback` route in
 * the auth group. For now the deep link points to the Inicio tab;
 * once the callback screen ships (v2.1) we'll update the URL.
 *
 * The mutation deliberately returns `void` — there is no
 * information in the response that the UI needs. The screen
 * renders a generic "Revisá tu correo..." message on success and
 * surfaces the typed error message on failure.
 */
import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

import { useDebouncedMutation } from './_debounce';

export interface ResetPasswordInput {
  email: string;
}

export interface UseResetPasswordResult {
  mutate: (input: ResetPasswordInput) => void;
  isPending: boolean;
  error: AppError | null;
  isSuccess: boolean;
  reset: () => void;
}

/** Send a password-reset email. Debounced 800ms after submit. */
export function useResetPassword(): UseResetPasswordResult {
  const mutation = useMutation<void, AppError, ResetPasswordInput>({
    mutationFn: async ({ email }) => {
      // `redirectTo` must be a URL the OS can deep-link back to.
      // `Linking.createURL` produces the `enchufate://` scheme on
      // native and a `https://` fallback on web (matching what the
      // Supabase dashboard lists in the Email auth config).
      const redirectTo = Linking.createURL('/');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw normalizeSupabaseError(error);
    },
  });

  return useDebouncedMutation(mutation) as UseResetPasswordResult;
}
