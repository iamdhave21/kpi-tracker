-- Matrix: build tracker for features shipped, issues to fix, and pending SQL.
-- Lives under Settings > Matrix (Super Admin / Manager only).

create table if not exists dev_matrix (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Feature','Issue','Pending SQL')),
  title text not null,
  description text,
  status text not null default 'Open' check (status in ('Open','In Progress','Done')),
  priority text not null default 'Medium' check (priority in ('Low','Medium','High')),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists dev_matrix_category_idx on dev_matrix(category);
create index if not exists dev_matrix_status_idx on dev_matrix(status);

alter table dev_matrix enable row level security;
create policy "Allow read" on dev_matrix for select using (true);
create policy "Allow insert" on dev_matrix for insert with check (true);
create policy "Allow update" on dev_matrix for update using (true);
create policy "Allow delete" on dev_matrix for delete using (true);

-- Pre-populate with a known issue surfaced during this session's audit:
insert into dev_matrix (category, title, description, status, priority, created_by) values
('Issue', 'Ticket status-update controls not discoverable', 'The Open/In Progress/Resolved/Closed buttons only appear after clicking to expand a ticket card. There is no visual cue on the collapsed card hinting that more controls exist underneath, which made it look like ticket status could not be updated at all.', 'Open', 'High', 'system');
