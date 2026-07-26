/**
 * useUnreadCount — count unread messages for a conversation.
 *
 * Uses the denormalized `unread_count` on the `Conversation` type
 * (populated by `useConversations`) rather than querying the
 * `messages` table directly. This keeps it cheap and avoids extra
 * round trips.
 *
 * For a real-time unread badge on the messages tab, the
 * `useConversations` query already refetches on conversation row
 * changes via realtime or invalidation.
 */
import { useMemo } from 'react';

import type { Conversation } from '@/features/messaging/types';

/**
 * Extract the unread count for a specific conversation from the
 * list of conversations. Returns 0 if not found.
 */
export function useUnreadCount(
  conversations: Conversation[] | undefined,
  conversationId: string | null,
): number {
  return useMemo(() => {
    if (!conversationId || !conversations) return 0;
    const conv = conversations.find((c) => c.id === conversationId);
    return conv?.unread_count ?? 0;
  }, [conversations, conversationId]);
}
