/**
 * Messaging — canonical TypeScript shapes.
 *
 * The shapes mirror the `public.conversations` and `public.messages`
 * tables that will be created in Phase 7 of `mvp-bootstrap`. The
 * conversation and message types are denormalized here (the
 * `*_name` and `*_avatar_url` fields are joined in from
 * `public.profiles`) so the UI doesn't have to do a second round-
 * trip to render each row. Phase 7's real query will use a Supabase
 * join with `profiles` and the hook signature stays identical.
 *
 * The `Message.pending` flag is set by the optimistic update in
 * `useSendMessage` while the local insert is waiting on the server
 * to confirm. The `MessageBubble` shows a small pending indicator
 * when this flag is set.
 */

export type MessageKind =
  | 'user'
  | 'system_reservation_requested'
  | 'system_reservation_confirmed'
  | 'system_reservation_cancelled';

export interface Message {
  id: string;
  conversation_id: string;
  /** `null` for system-injected messages (sender is the system, not a user). */
  sender_id: string | null;
  body: string;
  kind: MessageKind;
  /** Set by `useSendMessage`'s optimistic update; rolled back on error. */
  pending?: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  charger_id: string;
  /** Denormalized from `public.chargers.title` so the list row doesn't need a join. */
  charger_title: string;
  renter_id: string;
  renter_name: string;
  renter_avatar_url: string | null;
  host_id: string;
  host_name: string;
  host_avatar_url: string | null;
  last_message_at: string;
  /** Denormalized from the most recent `messages.body` for the preview row. */
  last_message_body: string;
  last_message_kind: MessageKind;
  /** Count of messages in this conversation the current user has not yet read. */
  unread_count: number;
}

/** What the other party's `name` and `avatar_url` resolve to for a given conversation. */
export interface OtherParty {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * Pick the "other party" (the participant that is NOT the current
 * user) from a conversation. Used by the conversation list row and
 * the thread header to render the right avatar + name without a
 * per-screen conditional.
 */
export function otherParty(conv: Conversation, currentUserId: string | null | undefined): OtherParty {
  if (currentUserId && conv.host_id === currentUserId) {
    return { id: conv.renter_id, name: conv.renter_name, avatarUrl: conv.renter_avatar_url };
  }
  // Default to host: when current user is the renter, the other
  // party is the host; when there's no current user (defensive)
  // we still want SOMETHING to render, so we fall back to host.
  return { id: conv.host_id, name: conv.host_name, avatarUrl: conv.host_avatar_url };
}
