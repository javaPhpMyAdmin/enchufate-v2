-- =========================================================================
-- conversations — RLS policies for enchufate-v2 (mvp-bootstrap Phase 7)
-- =========================================================================
-- Phase 7 task 7.1.5 enables RLS on `public.conversations` with 2
-- policies per `design.md §3.7`:
--
--   1. `conversations_select_party` — renter OR host can read.
--   2. `conversations_insert_renter` — only the renter can create
--      a conversation, and only when the host_id matches the
--      charger's owner_id. In practice, conversations are created
--      by the `handle_reservation_created` trigger (service_role)
--      so this policy is a defense-in-depth check.
--
-- No update policy: `last_message_at` is maintained by the
-- `update_conversation_last_message` trigger, which runs as the
-- function owner (SECURITY DEFINER) and bypasses RLS.
-- =========================================================================

alter table public.conversations enable row level security;

-- 1) Select: renter or host can read.
drop policy if exists "conversations_select_party" on public.conversations;
create policy "conversations_select_party"
  on public.conversations
  for select
  using (renter_id = auth.uid() or host_id = auth.uid());

-- 2) Insert: renter creates with host_id matching the charger's
--    owner. The subquery is a check; RLS on `public.chargers` lets
--    any signed-in user read `owner_id` (it returns only `active`
--    chargers to non-owners, but here we only need the owner of
--    the charger this conversation is for).
drop policy if exists "conversations_insert_renter" on public.conversations;
create policy "conversations_insert_renter"
  on public.conversations
  for insert
  with check (
    renter_id = auth.uid()
    and host_id = (
      select owner_id from public.chargers where id = charger_id
    )
  );
