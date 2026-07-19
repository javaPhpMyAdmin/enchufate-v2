/**
 * useProfile — fetch the current user's profile by id.
 *
 * **Phase 5 (this commit)**: returns the hardcoded `MOCK_PROFILE`
 * with a 200ms artificial delay so the screen can exercise its
 * loading state. The hook is wired up to read the `userId` from
 * `useSession()` so Phase 6 only needs to swap the `queryFn` body
 * for `.from('profiles').select().eq('id', uid).maybeSingle()` —
 * the query key, signature, and call sites stay identical.
 *
 * `enabled: Boolean(userId)` keeps the query idle when there is no
 * signed-in user, so the screen can render the guest EmptyState
 * without triggering a fetch.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';

import type { Profile } from '../types';

const MOCK_PROFILE: Profile = {
  id: 'mock-uid',
  email: 'demo@enchufate.uy',
  full_name: 'Usuario Demo',
  avatar_url: null,
  // Picked to land in March 2024 so the "Miembro desde marzo de
  // 2024" copy is visible in the spec scenario.
  created_at: '2024-03-15T12:00:00Z',
  updated_at: '2024-03-15T12:00:00Z',
};

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
      // Simulate network latency so the LoadingState is visible.
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_PROFILE;
    },
    staleTime: 60_000,
  });
}
