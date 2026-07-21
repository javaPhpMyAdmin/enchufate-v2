/**
 * useMessages — fetch the messages for a single conversation.
 *
 * Queries `public.messages` ordered ascending (oldest first) so the
 * inverted FlatList shows the most recent at the bottom.
 *
 * Realtime subscription: subscribes to INSERT events on
 * `public.messages` filtered by `conversation_id` and pushes new
 * rows into the TanStack Query cache via `setQueryData`. Cleanup
 * on unmount via `removeChannel`.
 *
 * Pagination (infinite scroll) is deferred to a future phase.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';

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
  const queryClient = useQueryClient();
  const enabled = Boolean(conversationId) && isFeatureEnabled('CHAT');

  // ----- Realtime subscription -----
  // Subscribes to INSERT events on public.messages for the given
  // conversation. New messages are pushed into the cache (append)
  // so the optimistic message from useSendMessage is deduped by
  // id at render time.
  useEffect(() => {
    if (!conversationId || !isFeatureEnabled('CHAT')) return;
    if (!supabase) return;

    const channel = supabase
      .channel(`messages:conv=${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: Message }) => {
          queryClient.setQueryData<Message[]>(
            QUERY_KEY(conversationId),
            (old) => [...(old ?? []), payload.new],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

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

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw normalizeSupabaseError(error);
      return (data ?? []) as Message[];
    },
    staleTime: 0,
  });
}
