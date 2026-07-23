-- Push tokens table for expo-notifications delivery.
-- One user can have multiple devices (phone + tablet, etc.).
-- The token column is unique so re-registering the same device
-- upserts cleanly via onConflict: 'token'.

create table if not exists public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);

create index idx_push_tokens_user_id on public.push_tokens(user_id);

-- RLS
alter table public.push_tokens enable row level security;

create policy "Users can insert their own push tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can read their own push tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on public.push_tokens for delete
  using (auth.uid() = user_id);
