/**
 * useSignUp — email + password sign-up mutation.
 *
 * Same debounce + error-shape contract as `useSignIn`. On success,
 * Supabase returns either a `session` (auto sign-in) or `null`
 * (email verification required) — either way, the user must verify
 * the email before they can sign in. The mutation returns the raw
 * Supabase response so the screen can decide which "success" copy
 * to show:
 *   - `session === null` → "Te enviamos un correo para verificar tu cuenta"
 *   - `session !== null` → "Listo, ya podés usar Enchufate" (rare;
 *     only when email verification is disabled in the Supabase
 *     dashboard).
 *
 * "Email already in use" is the second-most-common error and
 * Supabase surfaces it as a 422 with a specific message; we map
 * it to a typed `email_in_use` error so the screen renders the
 * Spanish copy without inspecting `error.message`.
 */
import { useMutation } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

import type { Session } from '../types';
import { useDebouncedMutation } from './_debounce';

export interface SignUpInput {
  email: string;
  password: string;
}

export interface SignUpResult {
  session: Session | null;
  /** True when the user must verify their email before signing in. */
  requiresEmailVerification: boolean;
}

export interface UseSignUpResult {
  mutate: (input: SignUpInput) => void;
  isPending: boolean;
  error: AppError | null;
  /** Last successful result (for the screen to show the right copy). */
  data: SignUpResult | null;
  reset: () => void;
}

/** Sign up with email + password. Debounced 800ms after submit. */
export function useSignUp(): UseSignUpResult {
  const mutation = useMutation<SignUpResult, AppError, SignUpInput>({
    mutationFn: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        // 422 + "already registered" is the standard
        // "email already in use" shape; map it to a typed error so
        // the screen doesn't have to parse strings.
        const normalized = normalizeSupabaseError(error);
        if (
          normalized.httpStatus === 422 ||
          /already.*registered|already.*in.*use/i.test(normalized.message)
        ) {
          throw new AppError({
            code: 'email_in_use',
            message: normalized.message,
            userMessage: 'Ya existe una cuenta con este correo',
            isAuthError: true,
            retryable: false,
          });
        }
        throw normalized;
      }
      return {
        session: data.session,
        requiresEmailVerification: data.session === null,
      };
    },
  });

  const debounced = useDebouncedMutation(mutation);
  return {
    ...debounced,
    data: mutation.data ?? null,
  };
}
