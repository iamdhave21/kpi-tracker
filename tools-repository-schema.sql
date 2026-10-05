-- Access and Tools Repository (MANAGEMENT > Access and Tools Repository):
-- one row per tool / subscription / access account the company pays for or
-- depends on. Run once in the Supabase SQL Editor.
--
-- Deliberately NOT stored here: passwords, API keys, or card numbers.
-- credentials_location says WHERE a login is kept (e.g. "Password manager,
-- Admin vault"); payment_method is a label only.
--
-- RLS follows the rest of the app (permissive; real access control is the
-- Admin/Super Admin gate in the app) -- so keep it to names, dates and costs.
-- Real row-level protection is part of the security hardening build.

create table public.tool_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  vendor text,
  category text,
  purpose text,
  access_name text,
  account_holder text,
  owner_name text,
  users_with_access text,
  ownership text not null default 'ab_bss' check (ownership in ('ab_bss', 'client')),
  client text,
  plan text,
  billing_cycle text check (billing_cycle in ('monthly', 'quarterly', 'annual', 'one_time', 'other')),
  cost numeric(12, 2),
  currency text not null default 'USD',
  seats_bought integer,
  seats_used integer,
  start_date date,
  end_date date,
  renewal_date date,
  payment_due_date date,
  auto_renew boolean not null default false,
  notice_period_days integer,
  payment_method text,
  credentials_location text,
  status text not null default 'active' check (status in ('active', 'trial', 'cancelled', 'expired')),
  last_access_review date,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tool_subscriptions enable row level security;
create policy tool_subscriptions_all on public.tool_subscriptions for all using (true) with check (true);
