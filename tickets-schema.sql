-- Tickets table for the AB BSS Operations Portal
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null default 'Other',
  priority text not null default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved','Closed')),
  created_by text not null,
  assigned_to text,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_created_by_idx on tickets(created_by);
create index if not exists tickets_status_idx on tickets(status);
create index if not exists tickets_created_at_idx on tickets(created_at desc);

-- RLS: enable row level security
alter table tickets enable row level security;

-- Allow all authenticated reads (app filters by scope in code)
create policy "Allow read" on tickets for select using (true);
create policy "Allow insert" on tickets for insert with check (true);
create policy "Allow update" on tickets for update using (true);
create policy "Allow delete" on tickets for delete using (true);
