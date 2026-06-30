-- ============================================================
-- Tasks: Manager/Team Lead assigns a task directly to a subordinate
-- Operations > Tasks
-- ============================================================

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to text not null,
  assigned_by text not null,
  due_date date,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists tasks_assigned_to_idx on tasks(assigned_to);
create index if not exists tasks_is_done_idx on tasks(is_done);

alter table tasks enable row level security;
create policy "Allow read" on tasks for select using (true);
create policy "Allow insert" on tasks for insert with check (true);
create policy "Allow update" on tasks for update using (true);
create policy "Allow delete" on tasks for delete using (true);
