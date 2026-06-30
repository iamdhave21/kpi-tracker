-- ============================================================
-- FIX: Profile photo upload (Home page + Org Chart avatars)
-- ============================================================

-- 1. Add the avatar_url column to app_users if it doesn't exist yet
alter table app_users add column if not exists avatar_url text;

-- 2. Create the 'avatars' storage bucket (public, so photos can be viewed
--    without auth — same pattern as the 'attachments' bucket used elsewhere)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Storage policies for the avatars bucket — allow authenticated users
--    to upload/update/read. Drop-then-create so this is safe to re-run.
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
on storage.objects for insert
with check (bucket_id = 'avatars');

drop policy if exists "Authenticated users can update avatars" on storage.objects;
create policy "Authenticated users can update avatars"
on storage.objects for update
using (bucket_id = 'avatars');


-- ============================================================
-- FIX: Matrix page (Settings > Matrix) not loading
-- ============================================================

create table if not exists dev_matrix (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Feature','Issue','Pending SQL')),
  title text not null,
  description text,
  status text not null default 'Open' check (status in ('Open','In Progress','Done')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists dev_matrix_category_idx on dev_matrix(category);
create index if not exists dev_matrix_status_idx on dev_matrix(status);

alter table dev_matrix enable row level security;

drop policy if exists "Allow read" on dev_matrix;
create policy "Allow read" on dev_matrix for select using (true);

drop policy if exists "Allow insert" on dev_matrix;
create policy "Allow insert" on dev_matrix for insert with check (true);

drop policy if exists "Allow update" on dev_matrix;
create policy "Allow update" on dev_matrix for update using (true);

drop policy if exists "Allow delete" on dev_matrix;
create policy "Allow delete" on dev_matrix for delete using (true);

-- Seed with the ticket-visibility issue found and already fixed this session
insert into dev_matrix (category, title, description, status, priority, created_by)
select 'Issue', 'Ticket status-update controls not discoverable',
  'The Open/In Progress/Resolved/Closed buttons only appeared after clicking to expand a ticket card. Fixed: now always visible on the card.',
  'Done', 'High', 'system'
where not exists (
  select 1 from dev_matrix where title = 'Ticket status-update controls not discoverable'
);

-- ============================================================
-- Verify both fixes worked — run this after the above:
-- ============================================================
-- select column_name from information_schema.columns where table_name = 'app_users' and column_name = 'avatar_url';
-- select * from storage.buckets where id = 'avatars';
-- select count(*) from dev_matrix;
