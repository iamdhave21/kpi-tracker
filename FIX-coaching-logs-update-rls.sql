-- Fix: coaching_logs is missing an UPDATE policy.
-- This caused "Sign & Acknowledge" to silently no-op — the update call
-- returns no error (RLS just filters the row to 0 rows affected), so the
-- UI shows a false success toast while the agent_acknowledged flag never
-- actually flips in the database. Same root cause as the other RLS gaps
-- fixed previously (directory_links, announcements, huddle_notes, etc).

alter table coaching_logs enable row level security;
drop policy if exists "Allow update" on coaching_logs;
create policy "Allow update" on coaching_logs for update using (true) with check (true);

-- one_on_one_logs has the same gap (created in the same migration, same
-- missing policy) — fixing proactively since it'll hit the same issue
-- the moment anything tries to update a 1-on-1 log record.
alter table one_on_one_logs enable row level security;
drop policy if exists "Allow update" on one_on_one_logs;
create policy "Allow update" on one_on_one_logs for update using (true) with check (true);
