/**
 * useProfile — fetch the current user's profile by id.
 *
 * `enabled: Boolean(userId)` keeps the query idle when there is no
 * signed-in user, so the screen can render the guest EmptyState
 * without triggering a fetch.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { supabase } from '@/lib/supabase';

import type { Profile } from '../types';

const QUERY_KEY = (uid: string) => ['profile', uid] as const;

/** Read the current user's profile. Returns a TanStack Query result. */
export function useProfile(
  userId: string | null | undefined,
): UseQueryResult<Profile, AppError> {
  return useQuery<Profile, AppError>({
    queryKey: userId ? QUERY_KEY(userId) : ['profile', 'anonymous'],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        // Defensive: enabled gate should prevent this, but a manual
        // refetch while logged out would land here. Surface a typed
        // auth error so the screen can render its empty state.
        throw new AppError({
          code: 'no_user',
          message: 'useProfile called without a user id',
          userMessage: 'Necesitás iniciar sesión para ver tu perfil.',
          isAuthError: true,
          retryable: false,
        });
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw normalizeSupabaseError(error);
      }

      if (!data) {
        throw new AppError({
          code: 'not_found',
          message: 'Profile not found',
          userMessage: 'No encontramos tu perfil.',
          retryable: true,
        });
      }

      return data as Profile;
    },
    staleTime: 60_000,
  });
}
