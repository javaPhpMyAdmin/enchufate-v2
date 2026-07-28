-- =========================================================================
-- charging_status — real-time P2P charging state
-- =========================================================================
-- Adds the `en_curso` state to the reservation lifecycle, tracking
-- columns on both `reservations` and `chargers`, trigger functions
-- to keep `chargers.current_charging_since` consistent, and the
-- `system_charging_started` message kind for conversation feedback.
--
-- This migration is PR 1 of the charging-status change (Foundation +
-- Core Logic). The Edge Function cron for 12h auto-timeout is in PR 2.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Extend reservation_status enum with the new `en_curso` state
-- -------------------------------------------------------------------------
-- `en_curso` sits between `confirmada` and `completada`:
--   solicitada → confirmada → en_curso → completada
-- Also en_curso → cancelada is valid (host or guest cancels mid-charge).
alter type public.reservation_status add value 'en_curso' before 'completada';

-- -------------------------------------------------------------------------
-- 2. Extend message_kind enum with the charging system message
-- -------------------------------------------------------------------------
alter type public.message_kind add value 'system_charging_started';

-- -------------------------------------------------------------------------
-- 3. Add charging_started_at to reservations
-- -------------------------------------------------------------------------
-- Set when the host starts charging. Used by the 12h auto-timeout
-- logic and the client-side timer display.
alter table public.reservations
  add column charging_started_at timestamptz;

-- -------------------------------------------------------------------------
-- 4. Add current_charging_since to chargers (denormalized for map filter)
-- -------------------------------------------------------------------------
-- Populated by the trigger below when a reservation transitions to
-- `en_curso`. Nullified when the reservation completes or cancels.
-- The map uses this column to render the orange charging pin layer
-- (active chargers get a lightning icon; idle chargers use the
-- default cargador.png).
alter table public.chargers
  add column current_charging_since timestamptz;

-- Index so the map query can filter efficiently on non-null values.
create index idx_chargers_charging on public.chargers (current_charging_since)
  where current_charging_since is not null;

-- -------------------------------------------------------------------------
-- 5. Handle charging started — keep chargers.current_charging_since in sync
-- -------------------------------------------------------------------------
-- Fires AFTER UPDATE on reservations when status transitions TO
-- `en_curso`. Sets `chargers.current_charging_since` to the
-- reservation's `charging_started_at`.
--
-- Also fires when status transitions FROM `en_curso` to
-- `completada` or `cancelada` — nullifies `current_charging_since`.
create or replace function public.handle_charging_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Transition to en_curso → set current_charging_since
  if new.status = 'en_curso' and (old.status is null or old.status <> 'en_curso') then
    update public.chargers
      set current_charging_since = new.charging_started_at
      where id = new.charger_id;
    return new;
  end if;

  -- Transition FROM en_curso to completada/cancelada → nullify
  if old.status = 'en_curso' and new.status in ('completada', 'cancelada') then
    update public.chargers
      set current_charging_since = null
      where id = new.charger_id;
    return new;
  end if;

  return new;
end;
$$;

create trigger trg_charging_status_change
  after update on public.reservations
  for each row execute function public.handle_charging_status_change();

-- -------------------------------------------------------------------------
-- 6. Handle 12h auto-timeout — BEFORE UPDATE trigger
-- -------------------------------------------------------------------------
-- When a reservation is `en_curso` and `charging_started_at + 12h`
-- is in the past, auto-transition to `completada`. This is a safety
-- net in case the Edge Function cron (PR 2) hasn't run yet.
--
-- This is additive to the existing `handle_reservation_completed`
-- trigger (which handles `confirmada` → `completada` when
-- `end_at < now()`). Both triggers fire on BEFORE UPDATE and
-- mutate `new.status` independently.
create or replace function public.handle_charging_timeout()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'en_curso'
     and new.charging_started_at is not null
     and new.charging_started_at + interval '12 hours' < now()
     and (old.status is null or old.status <> 'completada') then
    new.status := 'completada';
  end if;
  return new;
end;
$$;

create trigger trg_charging_timeout
  before update on public.reservations
  for each row execute function public.handle_charging_timeout();

-- -------------------------------------------------------------------------
-- 7. System message: handle charging started
-- -------------------------------------------------------------------------
-- Fires AFTER UPDATE when status transitions TO `en_curso`. Inserts
-- a `system_charging_started` system message into the conversation
-- so both parties see the charge session started.
create or replace function public.handle_charging_started_system_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv_id uuid;
  v_charger_title text;
begin
  if new.status = 'en_curso' and (old.status is null or old.status <> 'en_curso') then
    select c.id, ch.title
      into v_conv_id, v_charger_title
      from public.conversations c
      join public.chargers ch on ch.id = c.charger_id
     where c.charger_id = new.charger_id
       and c.renter_id  = new.renter_id;

    if v_conv_id is not null then
      insert into public.messages (conversation_id, sender_id, body, kind)
      values (
        v_conv_id,
        null,
        format('Carga iniciada en %s.', v_charger_title),
        'system_charging_started'
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_charging_started_msg
  after update on public.reservations
  for each row execute function public.handle_charging_started_system_message();

-- -------------------------------------------------------------------------
-- 8. Realtime publication — add chargers so map subscriptions pick up
--    `current_charging_since` changes in real-time.
-- -------------------------------------------------------------------------
-- `chargers` may already be in the publication (safe, no-op on conflict).
alter publication supabase_realtime add table public.chargers;
