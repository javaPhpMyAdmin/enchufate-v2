-- =========================================================================
-- conversations — initial table for enchufate-v2 (mvp-bootstrap Phase 7)
-- =========================================================================
-- A 1:1 thread between a renter (guest) and a host for a given
-- charger. Created on demand by the `handle_reservation_created`
-- trigger (see 20260719000007_triggers.sql); the unique constraint
-- on (charger_id, renter_id) makes the trigger idempotent.
--
-- Schema mirrors `design.md §3.4`:
--   - id uuid pk
--   - charger_id fk -> chargers (cascade delete: a removed charger
--     removes its conversations + messages)
--   - renter_id / host_id fk -> profiles (cascade)
--   - last_message_at timestamptz default now() — updated by the
--     `update_conversation_last_message` trigger
--   - unique (charger_id, renter_id) — one thread per (charger, renter)
--     pair; the host is implied by `chargers.owner_id`
-- =========================================================================

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  charger_id      uuid not null references public.chargers(id) on delete cascade,
  renter_id       uuid not null references public.profiles(id) on delete cascade,
  host_id         uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  -- One thread per (charger, renter) pair. The host is derived
  -- from chargers.owner_id; the unique key makes the
  -- `handle_reservation_created` trigger idempotent across retries.
  unique (charger_id, renter_id)
);

-- Indexes: renter-side and host-side reads are the two main paths
-- (the messages list query uses both).
create index idx_conversations_renter on public.conversations (renter_id);
create index idx_conversations_host on public.conversations (host_id);
create index idx_conversations_last_message_at
  on public.conversations (last_message_at desc);
