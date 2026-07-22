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
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AppError, normalizeSupabaseError } from '@/lib/error';
import { isFeatureEnabled } from '@/lib/features';
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
        return [];
      }

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, charger_id, renter_id, host_id, last_message_at,
          last_message_body, last_message_kind,
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
        unread_count: 0, // TODO: implement with conversation_reads table
      }));
    },
    staleTime: 15_000,
  });
}
