-- ============================================================
-- Operating Cadence tracker: checkboxes + notes + compliance
-- Team Lead Tools > Operating Cadence
-- ============================================================

create table if not exists cadence_completions (
  id uuid primary key default gen_random_uuid(),
  team_lead_email text not null,
  item_id text not null,
  frequency text not null check (frequency in ('daily','weekly','monthly')),
  period_key text not null,
  done boolean not null default false,
  note text,
  updated_at timestamptz not null default now(),
  unique(team_lead_email, item_id, period_key)
);

create index if not exists cadence_completions_email_idx on cadence_completions(team_lead_email);
create index if not exists cadence_completions_period_idx on cadence_completions(period_key);

alter table cadence_completions enable row level security;
create policy "Allow read" on cadence_completions for select using (true);
create policy "Allow insert" on cadence_completions for insert with check (true);
create policy "Allow update" on cadence_completions for update using (true);
