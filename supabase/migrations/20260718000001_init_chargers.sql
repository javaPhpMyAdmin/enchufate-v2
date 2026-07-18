-- =========================================================================
-- chargers — initial table for enchufate-v2 (mvp-bootstrap Phase 4)
-- =========================================================================
-- Phase 4 ships this CREATE TABLE so Phase 6 can RLS-enable it
-- alongside the publish flow. No RLS is applied here on purpose:
-- the anon key is revoked in this phase, so no client code reads
-- the table yet. Phase 6 (task 6.1) layers in the 4 RLS policies
-- (select_active, insert_own, update_own, delete_own) per
-- `design.md §3.7`.
-- =========================================================================

-- Enums
create type connector_type as enum ('tipo_1', 'tipo_2', 'ccs', 'chademo', 'tesla');
create type charger_status as enum ('active', 'paused');

-- Table
create table public.chargers (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 80),
  description     text not null check (char_length(description) <= 500),
  address         text not null,
  lat             double precision not null,
  lng             double precision not null,
  connector_type  connector_type not null,
  power_kw        numeric(6, 2) not null check (power_kw between 3.7 and 350),
  price_per_hour_usd numeric(8, 2) not null check (price_per_hour_usd > 0),
  min_reservation_minutes integer not null default 30
                       check (min_reservation_minutes in (30, 60, 120, 240, 480)),
  photos          text[] not null default '{}'::text[] check (array_length(photos, 1) <= 5),
  rules           text check (rules is null or char_length(rules) <= 300),
  schedule        jsonb not null default '{
    "mon":[{"from":"00:00","to":"23:59"}],
    "tue":[{"from":"00:00","to":"23:59"}],
    "wed":[{"from":"00:00","to":"23:59"}],
    "thu":[{"from":"00:00","to":"23:59"}],
    "fri":[{"from":"00:00","to":"23:59"}],
    "sat":[{"from":"00:00","to":"23:59"}],
    "sun":[{"from":"00:00","to":"23:59"}]
  }'::jsonb,
  status          charger_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes (Phase 4 ships the btree indexes; the GiST geo index lands
-- with Phase 6 once the btree column indexes prove useful in prod).
create index idx_chargers_owner on public.chargers (owner_id);
create index idx_chargers_status on public.chargers (status);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_chargers_updated_at
  before update on public.chargers
  for each row execute function public.set_updated_at();
