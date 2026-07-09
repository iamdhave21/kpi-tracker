-- Same pattern as directory_links, announcements, and huddle_notes:
-- game_score_submissions has RLS enabled but is missing an INSERT policy,
-- which is why screenshot submissions were failing.

alter table game_score_submissions enable row level security;

drop policy if exists "Allow read" on game_score_submissions;
create policy "Allow read" on game_score_submissions for select using (true);

drop policy if exists "Allow insert" on game_score_submissions;
create policy "Allow insert" on game_score_submissions for insert with check (true);

drop policy if exists "Allow update" on game_score_submissions;
create policy "Allow update" on game_score_submissions for update using (true) with check (true);

drop policy if exists "Allow delete" on game_score_submissions;
create policy "Allow delete" on game_score_submissions for delete using (true);

-- game_scores (the approved/leaderboard table) is written to by an admin
-- action (approving a submission), so it's worth checking too while we're here.
alter table game_scores enable row level security;

drop policy if exists "Allow read" on game_scores;
create policy "Allow read" on game_scores for select using (true);

drop policy if exists "Allow insert" on game_scores;
create policy "Allow insert" on game_scores for insert with check (true);

drop policy if exists "Allow update" on game_scores;
create policy "Allow update" on game_scores for update using (true) with check (true);

drop policy if exists "Allow delete" on game_scores;
create policy "Allow delete" on game_scores for delete using (true);
