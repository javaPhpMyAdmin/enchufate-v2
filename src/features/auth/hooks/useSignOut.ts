/**
 * useSignOut — end the current session and reset client state.
 *
 * Three side effects run in sequence:
 *   1. `supabase.auth.signOut()` — invalidates the refresh token
 *      server-side and clears it from secure storage.
 *   2. `queryClient.clear()` — drops every cached query so the
 *      next user (or the same user, on a different account) does
 *      not see stale chargers / reservations / conversations.
 *   3. `useAuthStore.clearSession()` — resets the shadow store
 *      so non-React readers see the logged-out state.
 *
 * Redirects to `/` (the Inicio tab) on success. We don't pass a
 * specific tab because the auth-gated tabs would just re-render
 * their EmptyState with "Iniciá sesión" — sending the user home
 * is the friendlier landing.
 */
import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

import { useAuthStore } from '../stores/authStore';

export interface UseSignOutResult {
  signOut: () => void;
  isPending: boolean;
  error: AppError | null;
}

/** End the current session, clear caches, redirect home. */
export function useSignOut(): UseSignOutResult {
  const clearSession = useAuthStore((s) => s.clearSession);

  const mutation = useMutation<void, AppError, void>({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw normalizeSupabaseError(error);
    },
    onSuccess: () => {
      // Clear the TanStack Query cache BEFORE redirecting so the
      // post-sign-out Inicio / Mapa screens don't briefly render
      // a previous user's data.
      queryClient.clear();
      clearSession();
      router.replace('/' as never);
    },
  });

  const signOut = useCallback(() => {
    mutation.mutate();
  }, [mutation]);

  return { signOut, isPending: mutation.isPending, error: mutation.error };
}
