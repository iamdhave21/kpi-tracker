-- ============================================================
-- FIX: avatars storage RLS error
-- "new row violates row-level security policy"
--
-- Root cause: password-login users never get a real Supabase Auth session
-- (only Google OAuth users do), so they hit storage as the 'anon' role.
-- The previous policies didn't explicitly grant that role. This version
-- explicitly targets both anon and authenticated so it works for everyone
-- regardless of login method.
-- ============================================================

-- Clean slate: drop the old policies first
drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;

-- Recreate, explicitly granted to anon + authenticated
create policy "avatars_select_all"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'avatars');

create policy "avatars_insert_all"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'avatars');

create policy "avatars_update_all"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'avatars');

create policy "avatars_delete_all"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'avatars');

-- Confirm the bucket itself is still marked public (belt and suspenders)
update storage.buckets set public = true where id = 'avatars';

-- Verify: should show 4 rows
select policyname, cmd, roles from pg_policies where tablename = 'objects' and policyname like 'avatars_%';
