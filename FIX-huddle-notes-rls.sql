-- Same pattern as directory_links and announcements: huddle_notes has RLS
-- enabled but is missing INSERT (and likely UPDATE/DELETE) policies.

alter table huddle_notes enable row level security;

drop policy if exists "Allow read" on huddle_notes;
create policy "Allow read" on huddle_notes for select using (true);

drop policy if exists "Allow insert" on huddle_notes;
create policy "Allow insert" on huddle_notes for insert with check (true);

drop policy if exists "Allow update" on huddle_notes;
create policy "Allow update" on huddle_notes for update using (true) with check (true);

drop policy if exists "Allow delete" on huddle_notes;
create policy "Allow delete" on huddle_notes for delete using (true);
