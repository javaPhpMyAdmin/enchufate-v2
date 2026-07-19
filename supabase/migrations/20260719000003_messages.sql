-- =========================================================================
-- messages — initial table for enchufate-v2 (mvp-bootstrap Phase 7)
-- =========================================================================
-- Per-conversation messages. User messages are inserted by the
-- client via the `messages_insert_user` RLS policy. System messages
-- (kind = 'system_*') are inserted by the
-- `handle_reservation_*` triggers and by the
-- `system-message-injector` Edge Function with service_role.
--
-- Schema mirrors `design.md §3.5`:
--   - id uuid pk
--   - conversation_id fk -> conversations (cascade)
--   - sender_id fk -> profiles (set null on delete): nullable
--     because system messages have no human sender
--   - body text not null (CHECK enforced in app; max length lives
--     in the message Zod schema at src/lib/schemas/message.ts)
--   - kind enum: user | system_reservation_requested |
--     system_reservation_confirmed | system_reservation_cancelled
--     (system_reservation_completed is NOT in the enum: the
--     `completada` transition is silent per design.md §9.1)
--   - created_at timestamptz default now()
-- =========================================================================

-- Enum
create type message_kind as enum (
  'user',
  'system_reservation_requested',
  'system_reservation_confirmed',
  'system_reservation_cancelled'
);

-- Table
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  -- Nullable: system messages have sender_id = NULL. ON DELETE
  -- SET NULL keeps the message around if a profile is removed
  -- (useful for the audit trail).
  sender_id       uuid references public.profiles(id) on delete set null,
  body            text not null,
  kind            message_kind not null default 'user',
  created_at      timestamptz not null default now()
);

-- Index: messages are read in ascending order per conversation
-- (the FlatList with `inverted` shows the most recent at the bottom).
-- The composite index (conversation_id, created_at desc) supports
-- both the chronological read and the Realtime filter.
create index idx_messages_conversation_created
  on public.messages (conversation_id, created_at desc);
