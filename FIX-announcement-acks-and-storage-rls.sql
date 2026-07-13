-- Fix 1: announcement_acknowledgements has the same RLS gap as the other
-- 5 tables we've found this session (directory_links, announcements,
-- huddle_notes, game_score_submissions, game_scores). This one was
-- silently masked by a code bug (the app showed "Acknowledged!" even when
-- the insert failed) -- that bug is now fixed separately, and this closes
-- the actual root cause.

alter table announcement_acknowledgements enable row level security;

drop policy if exists "Allow read" on announcement_acknowledgements;
create policy "Allow read" on announcement_acknowledgements for select using (true);

drop policy if exists "Allow insert" on announcement_acknowledgements;
create policy "Allow insert" on announcement_acknowledgements for insert with check (true);

drop policy if exists "Allow update" on announcement_acknowledgements;
create policy "Allow update" on announcement_acknowledgements for update using (true) with check (true);

drop policy if exists "Allow delete" on announcement_acknowledgements;
create policy "Allow delete" on announcement_acknowledgements for delete using (true);


-- Fix 2: storage buckets (like "attachments") have their OWN separate RLS
-- system on storage.objects, completely independent from table RLS. We've
-- only ever checked/fixed regular table policies this session -- this is
-- the first check of the storage layer itself, which could explain upload
-- failures on Game of the Month screenshots, ticket attachments, etc. even
-- when the destination table's own policies are fine.
--
-- Note: storage.objects is owned by Supabase's internal system role, so
-- you can't run ALTER TABLE ... ENABLE ROW LEVEL SECURITY on it yourself --
-- that's fine, Supabase already has RLS enabled on it by default for every
-- project. You CAN still create policies on it though, which is all that's
-- actually needed here.

drop policy if exists "Allow read attachments" on storage.objects;
create policy "Allow read attachments" on storage.objects for select
  using (bucket_id = 'attachments');

drop policy if exists "Allow upload attachments" on storage.objects;
create policy "Allow upload attachments" on storage.objects for insert
  with check (bucket_id = 'attachments');

drop policy if exists "Allow update attachments" on storage.objects;
create policy "Allow update attachments" on storage.objects for update
  using (bucket_id = 'attachments') with check (bucket_id = 'attachments');

drop policy if exists "Allow delete attachments" on storage.objects;
create policy "Allow delete attachments" on storage.objects for delete
  using (bucket_id = 'attachments');

-- If you use an "avatars" bucket too (from the TL/employee photo feature),
-- uncomment and run this as well:
-- drop policy if exists "Allow read avatars" on storage.objects;
-- create policy "Allow read avatars" on storage.objects for select using (bucket_id = 'avatars');
-- drop policy if exists "Allow upload avatars" on storage.objects;
-- create policy "Allow upload avatars" on storage.objects for insert with check (bucket_id = 'avatars');
-- drop policy if exists "Allow update avatars" on storage.objects;
-- create policy "Allow update avatars" on storage.objects for update using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
-- drop policy if exists "Allow delete avatars" on storage.objects;
-- create policy "Allow delete avatars" on storage.objects for delete using (bucket_id = 'avatars');
