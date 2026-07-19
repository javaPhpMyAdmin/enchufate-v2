/**
 * Shared debounce wrapper for TanStack Query mutations.
 *
 * The 800ms cooldown pattern (per `design.md §7.2` and the auth
 * spec non-functional notes) prevents rapid double-taps from
 * spamming Supabase Auth. The cooldown starts AFTER a `mutate`
 * call — regardless of whether the mutation succeeds or fails —
 * so a 5-tap-spam can't fire 5 parallel `signInWithPassword`
 * requests.
 *
 * Used by `useSignIn` and `useSignUp`. NOT used by `useSignOut`
 * (sign-out should be immediate; no need to rate-limit) or
 * `useGoogleOAuth` (the OAuth dance opens a system browser and
 * debouncing it would confuse the user).
 */
import { useCallback, useRef, useState } from 'react';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

export const SUBMIT_DEBOUNCE_MS = 800;

export type DebouncedMutation<TData, TError, TVariables> = Pick<
  UseMutationResult<TData, TError, TVariables>,
  'mutate' | 'isPending' | 'error' | 'reset' | 'isSuccess'
>;

/**
 * Wraps a `useMutation` result so the `mutate` callback ignores
 * calls while a submit is pending OR a post-submit cooldown is
 * active. The wrapped `isPending` is `true` during either window.
 */
export function useDebouncedMutation<TData, TError, TVariables>(
  mutation: UseMutationResult<TData, TError, TVariables>,
): DebouncedMutation<TData, TError, TVariables> {
  const [cooldown, setCooldown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCooldown = useCallback(() => {
    setCooldown(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCooldown(false), SUBMIT_DEBOUNCE_MS);
  }, []);

  const mutate = useCallback(
    (input: TVariables) => {
      if (cooldown || mutation.isPending) return;
      startCooldown();
      mutation.mutate(input);
    },
    [cooldown, mutation, startCooldown],
  );

  return {
    mutate,
    isPending: cooldown || mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    isSuccess: mutation.isSuccess,
  };
}
