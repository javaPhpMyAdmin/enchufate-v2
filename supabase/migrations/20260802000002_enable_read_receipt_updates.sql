-- =========================================================================
-- enable_read_receipt_updates — RLS UPDATE policies for chat read receipts
-- =========================================================================
-- Phase 7 enabled RLS on `messages` (20260719000006) and `conversations`
-- (20260719000005) with SELECT + INSERT policies only. Their headers
-- state "no update policy: messages are immutable" / "no update policy:
-- last_message_at is maintained by the trigger" — that was true in MVP,
-- but `20260726000000_incremental_features` added `messages.read_at` and
-- `useMarkAsRead` now needs TWO client write paths:
--
--   1. `UPDATE messages SET read_at = now()` — the recipient stamps the
--      other party's messages as read (drives the double-tick).
--   2. `UPDATE conversations SET {renter|host}_unread_count = 0` — the
--      reader resets their OWN unread badge (drives the unread dot).
--
-- Without UPDATE policies both statements silently affect 0 rows
-- (RLS default-deny gives no error), so the double tick and the unread
-- dot never clear. This migration adds the narrowest possible UPDATE
-- surface:
--
--   `messages`:
--     - RLS UPDATE policy restricted to conversation participants.
--     - Column privilege: `authenticated` may ONLY update `read_at`
--       (table-level UPDATE revoked). A participant can never rewrite
--       `body`, `kind`, `sender_id`, etc., and columns added in the
--       future are fail-closed (no UPDATE grant until one is given).
--     - WITH CHECK forbids stamping YOUR OWN messages: `read_at`
--       means "the other party saw this", so only the recipient may
--       set it. System messages (`sender_id IS NULL`) are stampable
--       by either participant.
--     - BEFORE UPDATE guard trigger: refuses any change beyond
--       `read_at` (defense-in-depth on top of the column grant, so a
--       future migration that grants a new column does not silently
--       widen the surface) and forces the stamp to the server's
--       `now()` — a client-supplied timestamp is never trusted.
--
--   `conversations`:
--     - RLS UPDATE policy restricted to participants.
--     - Column privilege: `authenticated` may ONLY update the two
--       unread counters (table-level UPDATE revoked).
--     - BEFORE UPDATE guard trigger: each participant may change ONLY
--       their OWN counter, to a non-negative value no greater than
--       the current one (decrement/reset only — a participant can
--       never inflate their own badge); every other column must be
--       untouched. System-managed updates (the SECURITY DEFINER
--       triggers that maintain `last_message_*` and increment the
--       counters) run nested — `pg_trigger_depth() > 1` — and skip
--       both guards.
--
-- The SECURITY DEFINER trigger functions (`update_conversation_last_message`,
-- `handle_reservation_*`) execute with their owner's privileges and
-- bypass RLS, so they are unaffected by the grants below.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. messages — participant-only UPDATE of read_at
-- -------------------------------------------------------------------------
drop policy if exists "messages_update_read_at" on public.messages;
create policy "messages_update_read_at"
  on public.messages
  for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.renter_id = auth.uid() or c.host_id = auth.uid())
    )
  )
  with check (
    -- Only the recipient may stamp read_at: the message must NOT be
    -- one the caller sent. System messages (sender_id IS NULL) can be
    -- stamped by either participant.
    sender_id is distinct from auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.renter_id = auth.uid() or c.host_id = auth.uid())
    )
  );

-- Narrow the write surface: `authenticated` keeps UPDATE only on
-- `read_at`; `anon` loses table-level UPDATE entirely (RLS already
-- denies anon, this is defense-in-depth). Column grants are enforced
-- independently of RLS, so a policy that passes can never touch a
-- column without a grant — and future columns are fail-closed.
revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;

-- BEFORE UPDATE guard on messages. Two jobs:
--   1. Refuse any change beyond `read_at` — defense-in-depth on top
--      of the column grant, so a future migration that grants UPDATE
--      on a new column cannot silently widen the client write
--      surface.
--   2. Force a server-authoritative stamp: `read_at` is set to the
--      database's `now()`, ignoring whatever timestamp the client
--      supplied (clients cannot fake when a message was read).
-- System-managed updates (trigger chains) bypass the guard via
-- `pg_trigger_depth() > 1`, mirroring the conversations guard below.
create or replace function public.guard_messages_read_at_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- System-managed updates (trigger chains) bypass the guard.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Only read_at may change.
  if old.id is distinct from new.id
     or old.conversation_id is distinct from new.conversation_id
     or old.sender_id is distinct from new.sender_id
     or old.body is distinct from new.body
     or old.kind is distinct from new.kind
     or old.created_at is distinct from new.created_at then
    raise exception 'message update denied: participants may only update read_at';
  end if;

  -- Server-authoritative stamp: ignore the client-supplied value.
  new.read_at := now();

  return new;
end;
$$;

drop trigger if exists trg_messages_guard_read_at_update on public.messages;
create trigger trg_messages_guard_read_at_update
  before update on public.messages
  for each row execute function public.guard_messages_read_at_update();

-- -------------------------------------------------------------------------
-- 2. conversations — participant-only reset of their OWN unread counter
-- -------------------------------------------------------------------------
drop policy if exists "conversations_update_own_unread" on public.conversations;
create policy "conversations_update_own_unread"
  on public.conversations
  for update
  using (renter_id = auth.uid() or host_id = auth.uid())
  with check (renter_id = auth.uid() or host_id = auth.uid());

-- Column privilege: only the two unread counters are client-updateable.
-- Same rationale as the messages grant above (fail-closed for future
-- columns). Which participant may touch WHICH counter is enforced by
-- the guard trigger below, since column grants cannot express
-- per-user column rules.
revoke update on public.conversations from anon, authenticated;
grant update (renter_unread_count, host_unread_count) on public.conversations to authenticated;

-- BEFORE UPDATE guard: who may change which counter. Applies to
-- direct client updates only (pg_trigger_depth() = 1). Nested system
-- updates — the SECURITY DEFINER triggers that maintain
-- `last_message_*` and increment the counters — run at depth > 1 and
-- skip the guard.
create or replace function public.guard_conversations_unread_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- System-managed updates (trigger chains) bypass the guard.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Every column except the two unread counters must be untouched.
  if old.id is distinct from new.id
     or old.charger_id is distinct from new.charger_id
     or old.renter_id is distinct from new.renter_id
     or old.host_id is distinct from new.host_id
     or old.last_message_at is distinct from new.last_message_at
     or old.created_at is distinct from new.created_at
     or old.last_message_body is distinct from new.last_message_body
     or old.last_message_kind is distinct from new.last_message_kind
     or old.last_message_sender_id is distinct from new.last_message_sender_id then
    raise exception 'conversation update denied: participants may only change unread counters';
  end if;

  -- Each participant may only change their OWN counter, to a
  -- non-negative value no greater than the current one (decrement /
  -- reset only — a participant can never inflate their own badge).
  -- The other side's counter must be untouched.
  if auth.uid() = old.renter_id then
    if old.host_unread_count is distinct from new.host_unread_count
       or new.renter_unread_count < 0
       or new.renter_unread_count > old.renter_unread_count then
      raise exception 'conversation update denied: renter may only reset renter_unread_count';
    end if;
  elsif auth.uid() = old.host_id then
    if old.renter_unread_count is distinct from new.renter_unread_count
       or new.host_unread_count < 0
       or new.host_unread_count > old.host_unread_count then
      raise exception 'conversation update denied: host may only reset host_unread_count';
    end if;
  else
    -- Defense-in-depth: RLS already filters non-participants out, but
    -- if this trigger ever fires for a third party, refuse loudly.
    raise exception 'conversation update denied: user is not a participant';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_conversations_guard_unread_update on public.conversations;
create trigger trg_conversations_guard_unread_update
  before update on public.conversations
  for each row execute function public.guard_conversations_unread_update();
