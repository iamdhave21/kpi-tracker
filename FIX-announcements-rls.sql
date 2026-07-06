-- Same pattern as the directory_links fix: announcements likely has RLS
-- enabled with a read policy but no insert/update policy, which is why
-- posting a new announcement and editing an existing one were failing.

alter table announcements enable row level security;

drop policy if exists "Allow read" on announcements;
create policy "Allow read" on announcements for select using (true);

drop policy if exists "Allow insert" on announcements;
create policy "Allow insert" on announcements for insert with check (true);

drop policy if exists "Allow update" on announcements;
create policy "Allow update" on announcements for update using (true) with check (true);

drop policy if exists "Allow delete" on announcements;
create policy "Allow delete" on announcements for delete using (true);
