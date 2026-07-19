-- =========================================================================
-- charger-photos — Supabase Storage bucket for enchufate-v2
--                  (mvp-bootstrap Phase 6 PR-A)
-- =========================================================================
-- Per `design.md §3.9`, photos are stored in a public bucket at the
-- path `{owner_id}/{charger_id}/{photo_index}.jpg`. Reads are public
-- (so `expo-image` can render the URL without a signed token);
-- writes and deletes are gated on the first folder segment matching
-- the caller's `auth.uid()`.
--
-- The bucket is created with `public = true` because the image URLs
-- are embedded directly in the JSON charger record returned by
-- `.from('chargers').select()` and consumed by the public Mapa and
-- Inicio screens. Only the owner can write/delete, so no auth gate
-- is needed for read.
-- =========================================================================

-- Bucket. `on conflict do nothing` keeps the migration idempotent.
insert into storage.buckets (id, name, public)
values ('charger-photos', 'charger-photos', true)
on conflict (id) do nothing;

-- 1) Public SELECT: anyone can read a charger photo.
drop policy if exists "charger_photos_select_public" on storage.objects;
create policy "charger_photos_select_public"
  on storage.objects
  for select
  using (bucket_id = 'charger-photos');

-- 2) Owner-only INSERT: the first folder segment of the path must
--    equal the caller's `auth.uid()` cast to text. A user cannot
--    upload a photo under another user's prefix.
drop policy if exists "charger_photos_insert_own" on storage.objects;
create policy "charger_photos_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'charger-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Owner-only DELETE: same path-prefix check as INSERT.
drop policy if exists "charger_photos_delete_own" on storage.objects;
create policy "charger_photos_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'charger-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
