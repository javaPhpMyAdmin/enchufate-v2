/**
 * useMessages — fetch the messages for a single conversation.
 *
 * Queries `public.messages` ordered ascending (oldest first) so the
 * inverted FlatList shows the most recent at the bottom.
 *
 * Realtime subscription: subscribes to INSERT + UPDATE events on
 * `public.messages` filtered by `conversation_id`. INSERTs push new
 * rows into the TanStack Query cache via `setQueryData`; UPDATEs
 * (the other party's `read_at` stamp) merge the server row into the
 * cache so the sender's UI shows the double-tick without a refetch.
 * Cleanup on unmount via `removeChannel`.
 *
 * Pagination (infinite scroll) is deferred to a future phase.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { uniqueChannelId } from '@/lib/realtime';
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
  // Subscribes to INSERT + UPDATE events on public.messages for the
  // given conversation.
  //
  //   - INSERT: new messages are pushed into the cache (append) so
  //     the optimistic message from useSendMessage is deduped by
  //     id at render time.
  //   - UPDATE: the only client-side message update is the `read_at`
  //     stamp from the other party's useMarkAsRead — merge the
  //     server row into the cache so the sender's UI flips to the
  //     double-tick without a refetch.
  //
  // The channel name embeds `uniqueChannelId()` so every effect run
  // registers a brand-new channel. `supabase.channel(name)` returns an
  // already-subscribed channel when the name is reused, and calling
  // `.on(...)` on it throws "cannot add `postgres_changes` callbacks
  // ... after `subscribe()`". The name must stay unique because this
  // effect re-runs (React StrictMode double-invoke in dev, or
  // `conversationId` changing when the user navigates conversations).
  useEffect(() => {
    if (!conversationId || !isFeatureEnabled('CHAT')) return;
    if (!supabase) return;

    const channel = supabase
      .channel(`messages:conv=${conversationId}:${uniqueChannelId()}`)
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
            (old) => {
              const incoming = payload.new;
              // If a message with this ID already exists (e.g. from a refetch),
              // skip to avoid duplicates.
              if ((old ?? []).some((m) => m.id === incoming.id)) return old;
              // Replace any pending optimistic message with the same body + sender
              // so we don't show a brief duplicate flash.
              const withoutOptimistic = (old ?? []).filter(
                (m) =>
                  !(m.pending && m.body === incoming.body && m.sender_id === incoming.sender_id),
              );
              return [...withoutOptimistic, incoming];
            },
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: Message }) => {
          // `read_at` was stamped by the recipient — merge the server
          // row over the cached one so read receipts reach the sender's
          // UI in realtime. Id-miss is fine (pending optimistic rows
          // are replaced by the INSERT path, not here).
          queryClient.setQueryData<Message[]>(QUERY_KEY(conversationId), (old) =>
            (old ?? []).map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)),
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
