-- ============================================================
-- Ticket progress notes / comment thread
-- Lets the original submitter add supplementary details to their own
-- ticket after filing (without editing the locked core fields), and
-- lets Team Lead+ add status updates/resolution notes -- distinguished
-- visually as "Team Lead Update" in the UI.
-- ============================================================

create table if not exists ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  comment text not null,
  commented_by text not null,
  is_resolution boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ticket_comments_ticket_idx on ticket_comments(ticket_id);

alter table ticket_comments enable row level security;
create policy "Allow read" on ticket_comments for select using (true);
create policy "Allow insert" on ticket_comments for insert with check (true);
