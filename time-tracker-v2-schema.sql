-- Time Tracker v2: one row per employee per pay period, matching the
-- summary export format from the actual time tracking system (matched by
-- Employee ID, not name -- far more reliable). Replaces the daily-log
-- approach from the first version of this feature.

create table if not exists time_tracker_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete set null,
  employee_id_code text not null,   -- raw "ABBSS-100044" style code from the paste
  employee_name text not null,
  period_label text not null,       -- e.g. "June 16-30, 2026" (freeform, set at import time)
  month_label text not null,        -- e.g. "June 2026" (matches kpi_records.month_label)

  basic_hours_worked numeric default 0,
  days_worked numeric default 0,    -- scheduled working days in the period
  absent_days numeric default 0,
  late_hours numeric default 0,
  late_mins numeric default 0,
  undertime_hours numeric default 0,
  undertime_mins numeric default 0,
  total_sd_hours numeric default 0, -- "short duration" hours lost to absences
  holiday_days numeric default 0,
  restday_days numeric default 0,
  overtime_hours numeric default 0,
  night_diff_days numeric default 0,
  night_diff_ot_hours numeric default 0,

  billable_hours numeric default 0,
  non_billable_hours numeric default 0,

  computed_attendance_pct numeric,  -- 0-100, editable before applying

  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  applied_to_attendance boolean not null default false,
  applied_at timestamptz,

  unique(employee_id_code, period_label)
);

create index if not exists ttp_employee_idx on time_tracker_periods(employee_id);
create index if not exists ttp_period_idx on time_tracker_periods(period_label);
create index if not exists ttp_month_idx on time_tracker_periods(month_label);

alter table time_tracker_periods enable row level security;

drop policy if exists "Allow read" on time_tracker_periods;
create policy "Allow read" on time_tracker_periods for select using (true);

drop policy if exists "Allow insert" on time_tracker_periods;
create policy "Allow insert" on time_tracker_periods for insert with check (true);

drop policy if exists "Allow update" on time_tracker_periods;
create policy "Allow update" on time_tracker_periods for update using (true) with check (true);

drop policy if exists "Allow delete" on time_tracker_periods;
create policy "Allow delete" on time_tracker_periods for delete using (true);

-- The old daily-log table from the first version of this feature is no
-- longer used by the app. Safe to drop if you never applied any data from it.
-- drop table if exists time_tracker_entries;
