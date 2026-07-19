-- =========================================================================
-- messages — RLS policies for enchufate-v2 (mvp-bootstrap Phase 7)
-- =========================================================================
-- Phase 7 task 7.1.6 enables RLS on `public.messages` with 2 policies
-- per `design.md §3.7`:
--
--   1. `messages_select_party` — only the participants of the
--      conversation can read its messages. The check joins through
--      `conversations` to read `renter_id` and `host_id`.
--   2. `messages_insert_user` — a user can insert a message ONLY
--      when:
--        (a) they are the `sender_id` (so they can't impersonate)
--        (b) they are a participant of the conversation
--        (c) `kind = 'user'` (system messages are inserted only by
--            the `handle_reservation_*` triggers + the
--            `system-message-injector` Edge Function with
--            service_role, both of which bypass RLS)
--
-- No update / delete policy: messages are immutable in MVP.
-- =========================================================================

alter table public.messages enable row level security;

-- 1) Select: conversation participants only.
drop policy if exists "messages_select_party" on public.messages;
create policy "messages_select_party"
  on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.renter_id = auth.uid() or c.host_id = auth.uid())
    )
  );

-- 2) Insert: sender must be the caller AND a conversation
--    participant AND `kind` must be 'user'. System messages are
--    inserted by triggers + the service-role Edge Function
--    (security definer) which bypasses RLS.
drop policy if exists "messages_insert_user" on public.messages;
create policy "messages_insert_user"
  on public.messages
  for insert
  with check (
    sender_id = auth.uid()
    and kind = 'user'
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.renter_id = auth.uid() or c.host_id = auth.uid())
    )
  );
