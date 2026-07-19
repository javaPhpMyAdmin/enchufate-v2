-- =========================================================================
-- chargers — RLS policies for enchufate-v2 (mvp-bootstrap Phase 6 PR-A)
-- =========================================================================
-- Phase 6 PR-A enables RLS on `public.chargers` with 4 policies per
-- `design.md §3.7`. The intent is:
--
--   1. Anyone reads active chargers; the owner also sees their own
--      paused chargers regardless of status.
--   2. Authenticated users can only insert chargers they own.
--   3. Owners can update their own chargers.
--   4. Owners can delete their own chargers (the app uses
--      soft-delete via `status = 'paused'` for the MVP, but a future
--      hard-delete path is gated here for completeness).
--
-- A helper function `is_charger_owner(charger_id)` centralizes the
-- owner check so future policies (reservations, conversations) can
-- reuse it without duplicating the SQL.
--
-- Dependencies: this migration assumes `public.profiles` already
-- exists (created by `20260718000000_init_profiles.sql`).
-- =========================================================================

-- Enable RLS. Idempotent: safe to re-run.
alter table public.chargers enable row level security;

-- Helper: true when the current user owns the charger.
--
-- `security definer` so the function executes with the caller's
-- privileges; the body reads from `public.chargers` which has RLS,
-- so the owner check still works (the WHERE clause matches the
-- caller's own row, satisfying `chargers_select_active`).
-- `stable` so PostgreSQL can memoize within a single query.
-- `set search_path = public` for safety against search-path attacks.
create or replace function public.is_charger_owner(p_charger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chargers
    where id = p_charger_id
      and owner_id = auth.uid()
  );
$$;

-- 1) Public read: anyone sees active chargers; the owner also sees
--    their own (paused) chargers so the Perfil → Mis cargadores tab
--    can show a draft before activation.
drop policy if exists "chargers_select_active" on public.chargers;
create policy "chargers_select_active"
  on public.chargers
  for select
  using (status = 'active' or owner_id = auth.uid());

-- 2) Insert: the caller must be the owner of the new row.
drop policy if exists "chargers_insert_own" on public.chargers;
create policy "chargers_insert_own"
  on public.chargers
  for insert
  with check (owner_id = auth.uid());

-- 3) Update: owners only. The `with check` mirrors the `using` so
--    a malicious update cannot transfer ownership to a different
--    user.
drop policy if exists "chargers_update_own" on public.chargers;
create policy "chargers_update_own"
  on public.chargers
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 4) Delete: owners only.
drop policy if exists "chargers_delete_own" on public.chargers;
create policy "chargers_delete_own"
  on public.chargers
  for delete
  using (owner_id = auth.uid());
