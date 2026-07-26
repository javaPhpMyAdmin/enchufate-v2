-- Reviews table for charger ratings.
-- Guests rate chargers after completed reservations.
-- Denormalization trigger keeps chargers.avg_rating / review_count in sync.

-- 1. Charger column extensions (safe to add before the table exists)
alter table public.chargers
  add column if not exists avg_rating    numeric default 0,
  add column if not exists review_count  int     default 0;

-- 2. Reviews table
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  charger_id      uuid not null references public.chargers(id) on delete cascade,
  reviewer_id     uuid not null references public.profiles(id) on delete cascade,
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  rating          smallint not null check (rating >= 1 and rating <= 5),
  text            text,
  created_at      timestamptz not null default now(),
  unique (reservation_id)
);

create index idx_reviews_charger_id    on public.reviews(charger_id);
create index idx_reviews_reviewer_id   on public.reviews(reviewer_id);
create index idx_reviews_reservation_id on public.reviews(reservation_id);

-- 3. RLS
alter table public.reviews enable row level security;

-- Any authenticated user can read reviews.
create policy "reviews_select_authenticated"
  on public.reviews for select
  using (auth.uid() is not null);

-- Only the renter of a completed reservation may insert a review.
-- RLS policy checks:
--   a) reviewer_id = auth.uid() (must be the renter)
--   b) reservation exists with status = completada
--   c) is_reservation_party confirms the user is a party to the reservation
create policy "reviews_insert_renter_only"
  on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.reservations
      where id = reservation_id
        and status = 'completada'::reservation_status
        and renter_id = auth.uid()
    )
  );

-- 4. Denormalization trigger: recalculate avg_rating + review_count
--    on the parent charger after any INSERT, UPDATE, or DELETE.
create or replace function public.handle_review_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_charger_id uuid;
begin
  -- Determine which charger to recalculate.
  if TG_OP = 'DELETE' then
    target_charger_id := OLD.charger_id;
  else
    target_charger_id := NEW.charger_id;
  end if;

  update public.chargers
  set
    avg_rating = coalesce(
      (select round(avg(r.rating), 1) from public.reviews r where r.charger_id = target_charger_id),
      0
    ),
    review_count = (
      select count(*)::int from public.reviews r where r.charger_id = target_charger_id
    )
  where id = target_charger_id;

  return coalesce(NEW, OLD);
end;
$$;

create trigger review_created
  after insert or update or delete on public.reviews
  for each row
  execute function public.handle_review_created();
