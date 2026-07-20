-- =========================================================================
-- Profiles — enchufate-v2
-- =========================================================================
-- The profiles table is the canonical user record. Every foreign key
-- (chargers.owner_id, reservations.renter_id, conversations, messages)
-- references this table.
--
-- A trigger on auth.users auto-creates a profile row on signup
-- (email/password or Google OAuth). Display name and avatar are
-- extracted from the OAuth metadata when available.
-- =========================================================================

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'User profile — 1:1 with auth.users.';

-- Index for avatar lookups (conversations list joins on profiles).
create index idx_profiles_id on public.profiles (id);

-- -------------------------------------------------------------------------
-- Auto-create profile on user signup
-- -------------------------------------------------------------------------
-- Fires AFTER INSERT on auth.users. Extracts display name and avatar
-- from OAuth metadata (Google, Apple) or falls back to email prefix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- RLS policies
-- -------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Everyone can read profiles (needed for host info on charger detail,
-- conversation partner names, etc.)
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Users can update their own profile.
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- -------------------------------------------------------------------------
-- updated_at auto-refresh
-- -------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
