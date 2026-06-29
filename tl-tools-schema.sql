-- TL Tools: Coaching Log table
create table if not exists coaching_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  employee_name text not null,
  employee_email text,
  coached_by text,
  date date not null,
  type text not null default 'Performance', -- Performance | Behavior | Development | Recognition | Corrective Action
  discussion text not null,
  action_items text,
  next_session_date date,
  created_at timestamptz default now()
);

-- TL Tools: 1-on-1 Log table
create table if not exists one_on_one_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  employee_name text not null,
  employee_email text,
  conducted_by text,
  date date not null,
  agenda text,
  notes text,
  mood int check (mood between 1 and 5) default 3,
  follow_ups text,
  created_at timestamptz default now()
);

-- RLS: enable row-level security
alter table coaching_logs enable row level security;
alter table one_on_one_logs enable row level security;

-- Allow all authenticated reads (app filters by role in code)
create policy "Allow read" on coaching_logs for select using (true);
create policy "Allow insert" on coaching_logs for insert with check (true);
create policy "Allow delete" on coaching_logs for delete using (true);

create policy "Allow read" on one_on_one_logs for select using (true);
create policy "Allow insert" on one_on_one_logs for insert with check (true);
create policy "Allow delete" on one_on_one_logs for delete using (true);
