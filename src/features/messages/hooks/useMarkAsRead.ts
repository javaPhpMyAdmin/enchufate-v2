/**
 * useMarkAsRead — batch-mark all unread messages in a conversation
 * as read for the current user.
 *
 * Called when the user opens a conversation thread. Sets `read_at`
 * to `now()` on all messages where `read_at IS NULL` and
 * `sender_id != auth.uid()`. Also resets the unread counter on the
 * conversation row.
 *
 * Runs once per conversation open (fire-and-forget, best-effort).
 */
import { useCallback } from 'react';

import { isFeatureEnabled } from '@/lib/features';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/features/auth/hooks/useSession';

export function useMarkAsRead(conversationId: string | null) {
  const { user } = useSession();

  const markAsRead = useCallback(async () => {
    if (!conversationId || !user?.id || !isFeatureEnabled('CHAT')) return;

    // Batch-update all unread messages NOT sent by me.
    // read_at = now() signals "the other party has seen this".
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('messages')
      .update({ read_at: now })
      .eq('conversation_id', conversationId)
      .is('read_at', null)
      .neq('sender_id', user.id);

    if (error) {
      console.warn('[useMarkAsRead] failed:', error.message);
      return;
    }

    // Reset unread counters on the conversation row.
    const isHost = await supabase
      .from('conversations')
      .select('host_id')
      .eq('id', conversationId)
      .single()
      .then(({ data }) => data?.host_id === user.id);

    await supabase
      .from('conversations')
      .update(
        isHost
          ? { host_unread_count: 0 }
          : { renter_unread_count: 0 },
      )
      .eq('id', conversationId);
  }, [conversationId, user?.id]);

  return { markAsRead };
}
