alter table tasks add column if not exists priority text not null default 'Medium' check (priority in ('Low','Medium','High'));
alter table tasks add column if not exists status text not null default 'To Do' check (status in ('No Status','To Do','In Progress','Complete'));

-- Backfill status from the existing is_done flag so nothing already in
-- progress silently resets to "To Do".
update tasks set status = 'Complete' where is_done = true and status = 'To Do';
