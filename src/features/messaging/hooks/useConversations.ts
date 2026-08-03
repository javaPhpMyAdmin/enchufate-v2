/**
 * useConversations — fetch the signed-in user's 1:1 conversation list.
 *
 * Queries `public.conversations` with joins to `profiles` and
 * `chargers` so the UI gets denormalized rows in a single round-trip.
 * The `.or()` filter returns conversations where the current user is
 * either the renter or the host.
 *
 * The `CHAT` feature flag gates the entire hook: when the flag is
 * off, the hook returns an empty array and `isLoading` flips to
 * `false` immediately, so the screen can render its empty state
 * without a fetch round-trip.
 *
 * Realtime: subscribes to any change on `public.conversations` and
 * invalidates the `['conversations']` cache, so the unread dot and
 * the last-message preview stay fresh. RLS scopes the channel to
 * rows the user can SELECT (their own conversations), so no
 * user-scoped filter is needed.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
import { uniqueChannelId } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';

import type { Conversation, MessageKind } from '../types';

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
  const queryClient = useQueryClient();
  const enabled = Boolean(userId) && isFeatureEnabled('CHAT');

  // ----- Realtime subscription -----
  // Invalidates the conversations cache on any INSERT/UPDATE to
  // `public.conversations`. Two flows depend on it:
  //   - the reader's unread reset (`useMarkAsRead` UPDATEs the
  //     counter to 0) → the list drops the unread dot;
  //   - every message INSERT bumps `last_message_*` via the
  //     `update_conversation_last_message` trigger → the list shows
  //     the new preview and moves the conversation to the top.
  // RLS filters the channel to rows the caller can SELECT, so a
  // broad filter (no user-scoped predicate) only delivers events for
  // the caller's own conversations. We invalidate rather than
  // `setQueryData` because the payload is a raw row and the cache
  // stores the denormalized `Conversation` shape.
  //
  // The channel name embeds `uniqueChannelId()` — see useMessages
  // for why (re-registering a used channel name throws).
  useEffect(() => {
    if (!userId || !isFeatureEnabled('CHAT')) return;
    if (!supabase) return;

    const channel = supabase
      .channel(`conversations:user=${userId}:${uniqueChannelId()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

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
        return [];
      }

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, charger_id, renter_id, host_id, last_message_at,
          last_message_body, last_message_kind,
          host_unread_count, renter_unread_count,
          renter:profiles!renter_id(id, full_name, avatar_url),
          host:profiles!host_id(id, full_name, avatar_url),
          charger:chargers(id, title)
        `)
        .or(`renter_id.eq.${userId},host_id.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw normalizeSupabaseError(error);

      // Map Supabase join shape to our denormalized Conversation type.
      return (data ?? []).map((row) => ({
        id: row.id,
        charger_id: row.charger_id,
        charger_title: (row.charger as any)?.title ?? '',
        renter_id: row.renter_id,
        renter_name: (row.renter as any)?.full_name ?? '',
        renter_avatar_url: (row.renter as any)?.avatar_url ?? null,
        host_id: row.host_id,
        host_name: (row.host as any)?.full_name ?? '',
        host_avatar_url: (row.host as any)?.avatar_url ?? null,
        last_message_at: row.last_message_at,
        last_message_body: row.last_message_body ?? '',
        last_message_kind: (row.last_message_kind ?? 'user') as MessageKind,
        unread_count: userId === row.renter_id
          ? row.renter_unread_count
          : row.host_unread_count,
      }));
    },
    staleTime: 15_000,
  });
}
