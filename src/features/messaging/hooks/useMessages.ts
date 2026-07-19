/**
 * useMessages — fetch the messages for a single conversation.
 *
 * **Phase 5 (this commit)**: returns the hardcoded
 * `MOCK_MESSAGES[conversationId]` array with a 200ms artificial
 * delay. The array is ordered ASCENDING (oldest first) so the
 * `FlatList` with `inverted` displays the most recent message at
 * the bottom — the chat convention.
 *
 * **Phase 7 (next)**: replace with
 * `.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true })`
 * plus a Supabase Realtime subscription that invalidates this
 * query key on `INSERT`. The hook signature stays identical.
 *
 * Pagination (50 at a time, infinite scroll) is a Phase 7
 * concern — Phase 5 returns the full mock array.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';

import { MOCK_MESSAGES } from '../data/mockMessages';
import type { Message } from '../types';

const QUERY_KEY = (convId: string) => ['messages', convId] as const;

export interface UseMessagesResult {
  data: Message[] | undefined;
  isLoading: boolean;
  error: AppError | null;
}

/** Messages for a single conversation, oldest first. */
export function useMessages(
  conversationId: string | null | undefined,
): UseQueryResult<Message[], AppError> {
  const enabled = Boolean(conversationId) && isFeatureEnabled('CHAT');

  return useQuery<Message[], AppError>({
    queryKey: conversationId ? QUERY_KEY(conversationId) : ['messages', 'anonymous'],
    enabled,
    queryFn: async () => {
      if (!conversationId) {
        throw new AppError({
          code: 'no_conversation',
          message: 'useMessages called without a conversation id',
          userMessage: 'No encontramos esta conversación.',
          isAuthError: false,
          retryable: false,
        });
      }
      if (!isFeatureEnabled('CHAT')) {
        return [];
      }
      await new Promise((r) => setTimeout(r, 200));
      return MOCK_MESSAGES[conversationId] ?? [];
    },
    // Realtime is the source of truth in Phase 7; for now the mock
    // data is "always fresh" and we let the optimistic mutation
    // re-invalidate the key.
    staleTime: 0,
  });
}
