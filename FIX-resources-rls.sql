-- Same recurring pattern as directory_links, announcements, huddle_notes,
-- game_score_submissions/game_scores, and announcement_acknowledgements:
-- resources has RLS enabled but is missing an INSERT policy.

alter table resources enable row level security;

drop policy if exists "Allow read" on resources;
create policy "Allow read" on resources for select using (true);

drop policy if exists "Allow insert" on resources;
create policy "Allow insert" on resources for insert with check (true);

drop policy if exists "Allow update" on resources;
create policy "Allow update" on resources for update using (true) with check (true);

drop policy if exists "Allow delete" on resources;
create policy "Allow delete" on resources for delete using (true);
