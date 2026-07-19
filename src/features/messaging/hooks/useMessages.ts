/**
 * useMessages — fetch the messages for a single conversation.
 *
 * **Phase 5 (initial commit)**: returned the hardcoded
 * `MOCK_MESSAGES[conversationId]` array with a 200ms artificial
 * delay. The array is ordered ASCENDING (oldest first) so the
 * `FlatList` with `inverted` displays the most recent message
 * at the bottom — the chat convention.
 *
 * **Phase 7 (this commit — Realtime subscription)**:
 *   - The mock fetch path is preserved (the user hasn't applied
 *     the SQL migrations yet + the MOCK_SUPABASE flag is on by
 *     default). The `staleTime: 0` setting keeps the cache fresh
 *     so optimistic mutations + the Phase 5 manual
 *     invalidation paths still work.
 *   - When the MOCK_SUPABASE flag is OFF (real mode), the hook
 *     subscribes to a Supabase Realtime channel
 *     (`messages:conv={id}`) on mount and pushes new
 *     `INSERT` events into the TanStack Query cache via
 *     `queryClient.setQueryData(...)`. Cleanup:
 *     `supabase.removeChannel(channel)` on unmount.
 *   - The real-mode SELECT path is left as a TODO — the user
 *     wires the SELECT chain when they flip the flag + run
 *     `supabase gen types typescript`. The Realtime subscription
 *     is independent and works as soon as the migrations are
 *     applied (the `supabase_realtime` publication is added in
 *     `supabase/migrations/20260719000007_triggers.sql`).
 *
 * Pagination (50 at a time, infinite scroll) is deferred to
 * Phase 8 per the design. Phase 7 returns the full array.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { AppError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';

import { MOCK_MESSAGES } from '../data/mockMessages';
import type { Message } from '../types';

const QUERY_KEY = (convId: string) => ['messages', convId] as const;

const isMockSupabase = (): boolean =>
  !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_MOCK_SUPABASE === 'true';

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

  // ----- Realtime subscription (real mode only) -----
  // The mock path keeps the `staleTime: 0` invalidation via
  // useSendMessage.onSettled. The real path subscribes to the
  // `messages:conv={id}` channel and pushes new rows into the
  // cache. We use `setQueryData` (not invalidate) so the
  // optimistic message from useSendMessage doesn't get
  // overwritten by a server-side refetch.
  useEffect(() => {
    if (!conversationId || isMockSupabase() || !isFeatureEnabled('CHAT')) {
      return;
    }
    if (!supabase) {
      // Defensive — the singleton throws on construction when
      // credentials are missing, but TS still treats it as
      // non-nullable. No-op when the client is unavailable.
      return;
    }
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
          // Push the new message into the cache (oldest-first
          // ordering: append at the end). The optimistic message
          // from useSendMessage is deduped by id at render time.
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
      // ----- MOCK data path (default) -----
      if (isMockSupabase()) {
        await new Promise((r) => setTimeout(r, 200));
        return MOCK_MESSAGES[conversationId] ?? [];
      }
      // ----- REAL Supabase path -----
      // The @ts-expect-error + as unknown cast pattern is
      // consistent with the new hooks — the placeholder
      // src/lib/database.types.ts is strict-empty by design.
      const result = (await (supabase
        .from('messages' as never)
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }) as unknown as Promise<{
        data: Message[] | null;
        error: unknown;
      }>));
      if (result.error) {
        // We can't `throw normalizeSupabaseError(result.error)`
        // without losing type narrowing inside the hook; the
        // consumer (the screen) reads `error.userMessage` so we
        // just attach the raw message.
        throw new AppError({
          code: 'messages_load_failed',
          message: result.error instanceof Error ? result.error.message : 'messages load failed',
          userMessage: 'No pudimos cargar los mensajes. Intentá de nuevo.',
          retryable: true,
        });
      }
      return result.data ?? [];
    },
    // Realtime is the source of truth in Phase 7. The mock
    // branch uses the optimistic mutation's onSettled
    // invalidation; the real branch uses the channel's
    // setQueryData push (no refetch needed).
    staleTime: 0,
  });
}
