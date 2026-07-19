-- =========================================================================
-- reservations — RLS policies for enchufate-v2 (mvp-bootstrap Phase 7)
-- =========================================================================
-- Phase 7 task 7.1.4 enables RLS on `public.reservations` with 3
-- policies per `design.md §3.7`:
--
--   1. `reservations_select_party` — a user sees a reservation if
--      they are the renter OR the charger owner (host).
--   2. `reservations_insert_self` — only the renter can create a
--      reservation, and only with `status = 'solicitada'` (the
--      initial state). The with-check on `status` blocks the
--      client from pre-confirming.
--   3. `reservations_update_party` — both the renter and the host
--      can update a reservation (host confirms; either cancels).
--      The status transitions are gated client-side by the state
--      machine in `src/features/reservations/state-machine.ts` and
--      server-side by the `handle_reservation_completed` trigger
--      (auto-completes past `end_at`).
--
-- The `service_role` bypasses RLS so the Edge Functions and
-- triggers can write as needed (e.g. the
-- `handle_reservation_completed` trigger mutates `status`).
-- =========================================================================

-- Enable RLS. Idempotent.
alter table public.reservations enable row level security;

-- Helper: true when the current user is a party to the reservation
-- (renter OR charger owner/host). Reused by the select + update
-- policies; matches the pattern in the chargers RLS migration.
create or replace function public.is_reservation_party(p_reservation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reservations r
    where r.id = p_reservation_id
      and (
        r.renter_id = auth.uid()
        or public.is_charger_owner(r.charger_id)
      )
  );
$$;

-- 1) Select: renter or host can read.
drop policy if exists "reservations_select_party" on public.reservations;
create policy "reservations_select_party"
  on public.reservations
  for select
  using (
    renter_id = auth.uid()
    or public.is_charger_owner(charger_id)
  );

-- 2) Insert: only the renter can create, and only with status =
--    'solicitada'. The with-check on `status` blocks the client
--    from short-circuiting to a confirmed state.
drop policy if exists "reservations_insert_self" on public.reservations;
create policy "reservations_insert_self"
  on public.reservations
  for insert
  with check (
    renter_id = auth.uid()
    and status = 'solicitada'
  );

-- 3) Update: renter or host can update. The state machine in
--    `src/features/reservations/state-machine.ts` enforces the
--    valid transitions client-side. Server-side, the
--    `handle_reservation_completed` trigger may flip status from
--    confirmada -> completada; it runs as the function owner
--    (SECURITY DEFINER), bypassing RLS for the row's UPDATE.
drop policy if exists "reservations_update_party" on public.reservations;
create policy "reservations_update_party"
  on public.reservations
  for update
  using (
    renter_id = auth.uid()
    or public.is_charger_owner(charger_id)
  )
  with check (
    renter_id = auth.uid()
    or public.is_charger_owner(charger_id)
  );
