/**
 * useMarkAsRead — batch-mark all unread messages in a conversation
 * as read for the current user.
 *
 * Called when the user opens a conversation thread, and re-armed by
 * the thread screen when new foreign messages arrive while it stays
 * open. Sets `read_at` to `now()` on all messages where
 * `read_at IS NULL` and `sender_id != auth.uid()`. Also resets the
 * unread counter on the conversation row.
 *
 * Fire-and-forget, best-effort: every failure path is logged with
 * context and nothing escapes as an unhandled rejection. The writes
 * are idempotent (`read_at IS NULL` / `counter = 0`), so re-runs are
 * server-side no-ops.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/hooks/useSession';

import type { Conversation } from '@/features/messaging/types';

export function useMarkAsRead(conversationId: string | null) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const markAsRead = useCallback(async () => {
    if (!conversationId || !user?.id || !isFeatureEnabled('CHAT')) return;

    try {
      // Batch-update all unread messages NOT sent by me.
      // read_at = now() signals "the other party has seen this". The
      // server-side `guard_messages_read_at_update` trigger overrides
      // the client-supplied timestamp with its own now(), so the
      // value here is only a placeholder.
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .is('read_at', null)
        .neq('sender_id', user.id);

      if (error) {
        console.warn('[useMarkAsRead] messages update failed:', error.message);
        return;
      }

      // Resolve the caller's role from the conversations cache when
      // available, avoiding a TOCTOU-prone second round-trip (a stale
      // host_id read would target the WRONG counter, which the RLS
      // guard trigger would then reject loudly). Fall back to a
      // direct read only when the cache is cold (e.g. the thread
      // opened before the conversations query resolved).
      let isHost: boolean | null = null;
      const cached = queryClient.getQueriesData<Conversation[]>({
        queryKey: ['conversations'],
      });
      for (const [, data] of cached) {
        const conv = (data ?? []).find((c) => c.id === conversationId);
        if (conv) {
          isHost = conv.host_id === user.id;
          break;
        }
      }

      if (isHost === null) {
        const { data: conv, error: selectError } = await supabase
          .from('conversations')
          .select('host_id')
          .eq('id', conversationId)
          .maybeSingle();
        if (selectError) {
          console.warn('[useMarkAsRead] role lookup failed:', selectError.message);
          return;
        }
        isHost = conv?.host_id === user.id;
      }

      // Reset the caller's OWN unread counter only.
      const { error: resetError } = await supabase
        .from('conversations')
        .update(isHost ? { host_unread_count: 0 } : { renter_unread_count: 0 })
        .eq('id', conversationId);
      if (resetError) {
        console.warn('[useMarkAsRead] unread reset failed:', resetError.message);
      }
    } catch (err) {
      console.warn('[useMarkAsRead] unexpected failure:', err);
    }
  }, [conversationId, user?.id, queryClient]);

  return { markAsRead };
}
