/**
 * useConversations — fetch the signed-in user's 1:1 conversation list.
 *
 * **Phase 5 (this commit)**: returns the hardcoded
 * `MOCK_CONVERSATIONS` with a 200ms artificial delay. Phase 7
 * swaps the `queryFn` body for
 * `.from('conversations').select('*, renter:profiles!renter_id(*),
 * host:profiles!host_id(*), charger:chargers(*)').or(\`renter_id.eq.
 * ${uid},host_id.eq.${uid}\`).order('last_message_at', { ascending:
 * false })`. The hook signature, query key, and call sites stay
 * identical.
 *
 * The `CHAT` feature flag gates the entire hook: when the flag is
 * off, the hook returns an empty array and `isLoading` flips to
 * `false` immediately, so the screen can render its empty state
 * without a fetch round-trip. This is the v2.1 flag from
 * `src/lib/features.ts` — kept on in MVP per the design.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';

import { MOCK_CONVERSATIONS } from '../data/mockConversations';
import type { Conversation } from '../types';

const QUERY_KEY = (uid: string) => ['conversations', uid] as const;

export interface UseConversationsResult {
  data: Conversation[] | undefined;
  isLoading: boolean;
  error: AppError | null;
}

/** Conversations where the current user is renter or host. */
export function useConversations(
  userId: string | null | undefined,
): UseQueryResult<Conversation[], AppError> {
  const enabled = Boolean(userId) && isFeatureEnabled('CHAT');

  return useQuery<Conversation[], AppError>({
    queryKey: userId ? QUERY_KEY(userId) : ['conversations', 'anonymous'],
    enabled,
    queryFn: async () => {
      if (!userId) {
        throw new AppError({
          code: 'no_user',
          message: 'useConversations called without a user id',
          userMessage: 'Necesitás iniciar sesión para ver tus conversaciones.',
          isAuthError: true,
          retryable: false,
        });
      }
      if (!isFeatureEnabled('CHAT')) {
        // Feature off — return empty without hitting the (mock) data layer.
        return [];
      }
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_CONVERSATIONS;
    },
    staleTime: 15_000,
  });
}
