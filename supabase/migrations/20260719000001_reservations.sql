-- =========================================================================
-- reservations — initial table for enchufate-v2 (mvp-bootstrap Phase 7)
-- =========================================================================
-- Phase 7 task 7.1 ships this CREATE TABLE. RLS policies land in
-- 7.4 (20260719000004_reservations_rls.sql). Triggers land in
-- 7.7 (20260719000007_triggers.sql).
--
-- Schema mirrors `design.md §3.3`:
--   - id uuid pk
--   - charger_id fk -> public.chargers(id) on delete cascade
--   - renter_id fk -> public.profiles(id) on delete cascade
--     (the design spec uses "renter"; the brief renames to "guest" but
--     the existing Phase 5 types + screens use "renter". We follow
--     the design to avoid renaming the entire feature surface.)
--   - start_at / end_at / horario_a_coordinar — hybrid time storage
--     (Q5 default from the V1 resolution): either BOTH timestamps OR
--     the free-text fallback, enforced by chk_time_or_text
--   - status enum: solicitada | confirmada | cancelada | completada
--   - cancelled_by: optional audit field (who clicked cancel)
--   - updated_at maintained by `set_updated_at()` (already exists
--     from 20260718000001_init_chargers.sql)
-- =========================================================================

-- Enum
create type reservation_status as enum (
  'solicitada',
  'confirmada',
  'cancelada',
  'completada'
);

-- Table
create table public.reservations (
  id                      uuid primary key default gen_random_uuid(),
  charger_id              uuid not null references public.chargers(id) on delete cascade,
  renter_id               uuid not null references public.profiles(id) on delete cascade,
  start_at                timestamptz,
  end_at                  timestamptz,
  horario_a_coordinar     text,
  status                  reservation_status not null default 'solicitada',
  cancelled_by            uuid references public.profiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Q5 default: hybrid time storage. Either both timestamps set OR
  -- the free-text fallback. Never both, never neither.
  constraint chk_time_or_text check (
    (start_at is not null and end_at is not null)
    or horario_a_coordinar is not null
  ),
  -- When both timestamps are set, end must be strictly after start.
  constraint chk_time_order check (
    start_at is null or end_at is null or end_at > start_at
  )
);

-- Indexes — per the brief: (charger_id), (renter_id), (host_id).
-- The design uses (renter_id) since `host_id` is implied by
-- `charger_id -> chargers.owner_id`. We add both: the btree on
-- charger_id is the host-side query, and renter_id is the renter-
-- side query (the reservations list segmented control filters by
-- role via the .or() chain in the client).
create index idx_reservations_charger on public.reservations (charger_id);
create index idx_reservations_renter on public.reservations (renter_id);
create index idx_reservations_status on public.reservations (status);
create index idx_reservations_start_at on public.reservations (start_at);

-- updated_at trigger (reuses the function from 20260718000001)
create trigger trg_reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();
