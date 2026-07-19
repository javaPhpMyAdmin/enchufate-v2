-- =========================================================================
-- Reservation lifecycle triggers for enchufate-v2 (mvp-bootstrap Phase 7)
-- =========================================================================
-- Phase 7 task 7.2 ships 5 trigger functions:
--
--   1. `handle_reservation_created` (AFTER INSERT on reservations)
--      Auto-creates a `conversations` row keyed by
--      (charger_id, renter_id). Idempotent: the unique constraint
--      on `conversations(charger_id, renter_id)` keeps a duplicate
--      INSERT from breaking. We `on conflict do update set
--      last_message_at = now()` so a retry of the reservation
--      insert refreshes the conversation's `last_message_at` to
--      keep the messages list sorted correctly.
--
--   2. `handle_reservation_requested_system_message` (AFTER INSERT
--      on reservations). Inserts a `system_reservation_requested`
--      row into `messages` with `sender_id = NULL`. The body uses
--      a voseo template: "¡Hola! Quiero reservar {charger_title}."
--      per `design.md §10.2`.
--
--   3. `handle_reservation_confirmed_system_message` (AFTER UPDATE
--      on reservations when `status` transitions TO 'confirmada').
--      Inserts a `system_reservation_confirmed` system message.
--      The body uses the voseo template: "¡Listo! Tu reserva de
--      {charger_title} fue confirmada. Chateamos para coordinar.
--      Dirección: {address}." per `design.md §10.2`.
--
--   4. `handle_reservation_cancelled_system_message` (AFTER UPDATE
--      on reservations when `status` transitions TO 'cancelada').
--      Inserts a `system_reservation_cancelled` system message.
--      The body uses the voseo template: "La reserva de
--      {charger_title} {time_desc} fue cancelada." with
--      `time_desc` formatted from `start_at`/`end_at` or
--      `horario_a_coordinar` per the design.
--
--   5. `update_conversation_last_message` (AFTER INSERT on
--      messages). Updates the parent conversation's
--      `last_message_at` so the conversations list can be sorted
--      by recency.
--
-- All 5 functions use `SECURITY DEFINER` so they execute with the
-- privileges of the function creator and can bypass RLS to insert
-- system messages with `sender_id = NULL`. `set search_path = public`
-- is a defense against search-path attacks per the Supabase docs.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. handle_reservation_created
-- -------------------------------------------------------------------------
create or replace function public.handle_reservation_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
begin
  select owner_id into v_host_id
  from public.chargers
  where id = new.charger_id;

  -- Idempotent: on conflict (charger_id, renter_id) we touch
  -- last_message_at so the conversation surfaces at the top of
  -- the list when a duplicate reservation INSERT is retried.
  insert into public.conversations (charger_id, renter_id, host_id)
  values (new.charger_id, new.renter_id, v_host_id)
  on conflict (charger_id, renter_id)
    do update set last_message_at = now();

  return new;
end;
$$;

create trigger trg_reservation_created
  after insert on public.reservations
  for each row execute function public.handle_reservation_created();

-- -------------------------------------------------------------------------
-- 2. handle_reservation_requested_system_message
-- -------------------------------------------------------------------------
create or replace function public.handle_reservation_requested_system_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_charger_title text;
begin
  select c.id, ch.title
    into v_conv_id, v_charger_title
    from public.conversations c
    join public.chargers ch on ch.id = c.charger_id
   where c.charger_id = new.charger_id
     and c.renter_id  = new.renter_id;

  insert into public.messages (conversation_id, sender_id, body, kind)
  values (
    v_conv_id,
    null,
    format('¡Hola! Quiero reservar %s.', v_charger_title),
    'system_reservation_requested'
  );

  -- last_message_at is also updated by the
  -- `update_conversation_last_message` trigger, but we set it
  -- here too so the conversation surfaces at the top of the list
  -- even if the message-trigger ordering differs across DB
  -- versions.
  update public.conversations
     set last_message_at = now()
   where id = v_conv_id;

  return new;
end;
$$;

create trigger trg_reservation_requested_msg
  after insert on public.reservations
  for each row execute function public.handle_reservation_requested_system_message();

-- -------------------------------------------------------------------------
-- 3. handle_reservation_confirmed_system_message
-- -------------------------------------------------------------------------
create or replace function public.handle_reservation_confirmed_system_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_charger_title text;
  v_charger_address text;
begin
  -- Skip when the status didn't transition to 'confirmada'. The
  -- trigger fires AFTER UPDATE, so we read `old.status` to detect
  -- the transition.
  if new.status = 'confirmada' and (old.status is null or old.status <> 'confirmada') then
    select c.id, ch.title, ch.address
      into v_conv_id, v_charger_title, v_charger_address
      from public.conversations c
      join public.chargers ch on ch.id = c.charger_id
     where c.charger_id = new.charger_id
       and c.renter_id  = new.renter_id;

    if v_conv_id is not null then
      insert into public.messages (conversation_id, sender_id, body, kind)
      values (
        v_conv_id,
        null,
        format(
          '¡Listo! Tu reserva de %s fue confirmada. Chateamos para coordinar. Dirección: %s.',
          v_charger_title,
          v_charger_address
        ),
        'system_reservation_confirmed'
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_reservation_confirmed_msg
  after update on public.reservations
  for each row execute function public.handle_reservation_confirmed_system_message();

-- -------------------------------------------------------------------------
-- 4. handle_reservation_cancelled_system_message
-- -------------------------------------------------------------------------
create or replace function public.handle_reservation_cancelled_system_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_charger_title text;
  v_time_desc text;
begin
  if new.status = 'cancelada' and (old.status is null or old.status <> 'cancelada') then
    select c.id, ch.title
      into v_conv_id, v_charger_title
      from public.conversations c
      join public.chargers ch on ch.id = c.charger_id
     where c.charger_id = new.charger_id
       and c.renter_id  = new.renter_id;

    if v_conv_id is not null then
      -- Build the `time_desc` per `design.md §10.2`:
      --   - structured: 'del 17/7 15:30 a 17:00' (DD/MM HH:MM)
      --   - free-text: '«horario a coordinar»'
      if new.start_at is not null and new.end_at is not null then
        v_time_desc := format(
          'del %s a %s',
          to_char(new.start_at at time zone 'America/Montevideo', 'DD/MM HH24:MI'),
          to_char(new.end_at   at time zone 'America/Montevideo', 'HH24:MI')
        );
      else
        v_time_desc := '«horario a coordinar»';
      end if;

      insert into public.messages (conversation_id, sender_id, body, kind)
      values (
        v_conv_id,
        null,
        format('La reserva de %s %s fue cancelada.', v_charger_title, v_time_desc),
        'system_reservation_cancelled'
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_reservation_cancelled_msg
  after update on public.reservations
  for each row execute function public.handle_reservation_cancelled_system_message();

-- -------------------------------------------------------------------------
-- 5. update_conversation_last_message
-- -------------------------------------------------------------------------
-- Fires AFTER INSERT on `messages` and bumps the parent
-- conversation's `last_message_at` to now(). This is the source of
-- truth for the conversations list sort order (the client
-- subscribes to UPDATE on `conversations` for live re-sorting).
create or replace function public.update_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_message_inserted
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

-- -------------------------------------------------------------------------
-- 6. handle_reservation_completed (BEFORE UPDATE — no message)
-- -------------------------------------------------------------------------
-- Time-based transition from 'confirmada' to 'completada' when
-- the end_at is in the past. Per `design.md §9.1` this is silent
-- (no system message, no push notification). Implemented as a
-- BEFORE UPDATE trigger that mutates `new.status` so the UPDATE
-- commits with the right state.
create or replace function public.handle_reservation_completed()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'confirmada'
     and new.end_at is not null
     and new.end_at < now()
     and (old.status is null or old.status <> 'completada') then
    new.status := 'completada';
  end if;
  return new;
end;
$$;

create trigger trg_reservation_completed
  before update on public.reservations
  for each row execute function public.handle_reservation_completed();

-- -------------------------------------------------------------------------
-- 7. Realtime publication — enable replication on the three tables
--    the client subscribes to per `design.md §3.8`.
-- -------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.conversations;
