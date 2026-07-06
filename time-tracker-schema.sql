-- Time Tracker: imported from the fortnightly Excel time logs.
-- Each row = one employee, one day. Status is auto-classified on import
-- based on Hours + Remarks, but can be manually overridden during review
-- before being applied to a KPI record's Attendance %.

create table if not exists time_tracker_entries (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  employee_id uuid references employees(id) on delete set null,
  work_date date not null,
  hours numeric,
  raw_remark text,
  status text not null default 'Present' check (status in (
    'Present', 'Late', 'Sick Leave', 'Emergency Leave', 'Slide Shift',
    'Half Day', 'Absent', 'Day Off'
  )),
  late_hours numeric default 0,
  non_billable_hours numeric default 0,
  period_label text not null,       -- e.g. "June 16-30, 2026" (matches the source sheet name)
  month_label text not null,        -- e.g. "June 2026" (matches kpi_records.month_label for apply step)
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  applied_to_attendance boolean not null default false,
  applied_at timestamptz
);

create index if not exists time_tracker_employee_idx on time_tracker_entries(employee_name);
create index if not exists time_tracker_period_idx on time_tracker_entries(period_label);
create index if not exists time_tracker_month_idx on time_tracker_entries(month_label);

alter table time_tracker_entries enable row level security;

drop policy if exists "Allow read" on time_tracker_entries;
create policy "Allow read" on time_tracker_entries for select using (true);

drop policy if exists "Allow insert" on time_tracker_entries;
create policy "Allow insert" on time_tracker_entries for insert with check (true);

drop policy if exists "Allow update" on time_tracker_entries;
create policy "Allow update" on time_tracker_entries for update using (true) with check (true);

drop policy if exists "Allow delete" on time_tracker_entries;
create policy "Allow delete" on time_tracker_entries for delete using (true);
