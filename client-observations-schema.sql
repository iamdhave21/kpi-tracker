-- Client Observations (OPERATIONS > Client Observations): what AB BSS staff
-- experience and document about a client -- events, process, behaviour,
-- performance gaps, praise, risks. INTERNAL ONLY: clients never see it.
-- Run once in the Supabase SQL Editor (two statements; run them one at a time).
--
-- Who sees what is decided in the app (lib/clientObs.ts): admins see all,
-- Team Leads see their own + their clients', everyone else only their own.
-- The table uses the app's usual permissive RLS, so real row-level
-- protection is part of the security hardening build -- avoid putting
-- anything in an entry you wouldn't want an unauthorised insider to read.

create table public.client_observations (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  event_date date not null,
  category text not null,
  tone text not null default 'neutral' check (tone in ('positive', 'neutral', 'concern', 'risk')),
  significance text not null default 'medium' check (significance in ('low', 'medium', 'high')),
  title text not null,
  details text not null,
  client_person text,
  client_person_role text,
  staff_involved text,
  links text,
  follow_up_needed boolean not null default false,
  follow_up_owner text,
  follow_up_due date,
  follow_up_done boolean not null default false,
  created_by text not null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- (second statement)
alter table public.client_observations enable row level security;
create policy client_observations_all on public.client_observations for all using (true) with check (true);
