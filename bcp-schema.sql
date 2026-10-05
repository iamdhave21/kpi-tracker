-- ============================================================
-- BCP (Business Continuity Planning): Task List + who's trained
-- Operations > BCP
-- ============================================================

create table if not exists bcp_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  description text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists bcp_task_coverage (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references bcp_tasks(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(task_id, employee_id)
);

create index if not exists bcp_tasks_category_idx on bcp_tasks(category);
create index if not exists bcp_task_coverage_task_idx on bcp_task_coverage(task_id);
create index if not exists bcp_task_coverage_employee_idx on bcp_task_coverage(employee_id);

alter table bcp_tasks enable row level security;
alter table bcp_task_coverage enable row level security;

create policy "Allow read" on bcp_tasks for select using (true);
create policy "Allow insert" on bcp_tasks for insert with check (true);
create policy "Allow update" on bcp_tasks for update using (true);
create policy "Allow delete" on bcp_tasks for delete using (true);

create policy "Allow read" on bcp_task_coverage for select using (true);
create policy "Allow insert" on bcp_task_coverage for insert with check (true);
create policy "Allow delete" on bcp_task_coverage for delete using (true);

-- No starter tasks: BCP is organised by department (Operations, Payroll,
-- Recruitment, Client Management, IT) and each department's tasks should be
-- entered by the people who own them. The old starter rows used an
-- 'Onboarding' label that is no longer a department.
