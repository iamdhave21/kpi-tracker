-- Client Portal: external, no-internal-login access for AB BSS's actual
-- clients (not staff). Entirely separate from app_users/Google Sign-In --
-- different tables, different session mechanism, zero shared code path
-- with internal auth. Run this once in the Supabase SQL Editor.
--
-- Design notes (read before running):
-- - client_contacts is the allowlist: only an email a Staff member has
--   explicitly added here can ever request a login link. Nobody can
--   self-register.
-- - client_login_tokens are single-use, 24-hour magic-link tokens sent by
--   email. client_sessions are the resulting logged-in session, also
--   valid for 24 hours from creation.
-- - handover_pack_items is the ONE shared, editable EWM template (Admin/
--   Super Admin can add/edit items in-app) used for every client -- per
--   explicit decision, this is NOT copied per client. handover_pack_records
--   is the one row PER CLIENT that actually tracks their progress against
--   that shared template.
-- - RLS on every table below is `using (true)` -- the same honest
--   real-world shape as the rest of this app (see AUDIT.md C2): the actual
--   access boundary is enforced in the Next.js API routes under
--   app/api/client-portal/*, which use the service role key and check the
--   caller's session token server-side before ever touching these tables.
--   A client's browser never talks to Supabase directly with the anon key
--   for any of this -- every read and write goes through those routes.
-- - The `client-uploads` storage bucket is created with NO storage.objects
--   policies for the anon/public role at all (unlike attachments/avatars/
--   av-scans, which all have permissive policies) -- so RLS's default
--   deny-all applies to anyone using the anon key. Only the service role
--   key (server-side only, never sent to any browser) can read or write
--   it. This is deliberately stricter than every other bucket in this app.

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  client text not null,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.client_contacts enable row level security;
create policy client_contacts_all on public.client_contacts for all using (true) with check (true);

create table public.client_login_tokens (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references client_contacts(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.client_login_tokens enable row level security;
create policy client_login_tokens_all on public.client_login_tokens for all using (true) with check (true);

create table public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references client_contacts(id) on delete cascade,
  session_token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.client_sessions enable row level security;
create policy client_sessions_all on public.client_sessions for all using (true) with check (true);

-- Shared, editable EWM checklist template (AB-ONB-01), one copy used by
-- every client -- editable via the Admin-side "Manage Checklist Items"
-- screen, same retire-not-delete convention as cadence_items so historical
-- submissions against a retired item are never orphaned.
create table public.handover_pack_items (
  id text primary key,
  section text not null,
  label text not null,
  description text,
  sort_order integer not null default 0,
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.handover_pack_items enable row level security;
create policy handover_pack_items_all on public.handover_pack_items for all using (true) with check (true);

-- One row per client's actual onboarding -- their own copy/instance
-- tracked against the shared template above.
create table public.handover_pack_records (
  id uuid primary key default gen_random_uuid(),
  client text not null,
  account_name text,
  contract_start_date date,
  target_go_live_date date,
  status text not null default 'in_progress' check (status in ('in_progress','accepted','accepted_with_gaps','not_accepted')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.handover_pack_records enable row level security;
create policy handover_pack_records_all on public.handover_pack_records for all using (true) with check (true);

create table public.handover_pack_submissions (
  id uuid primary key default gen_random_uuid(),
  pack_record_id uuid not null references handover_pack_records(id) on delete cascade,
  item_id text not null references handover_pack_items(id),
  received boolean not null default false,
  file_path text,
  file_name text,
  drive_link text,
  notes text,
  submitted_by text,
  submitted_at timestamptz,
  received_by text,
  received_at timestamptz,
  unique (pack_record_id, item_id)
);
alter table public.handover_pack_submissions enable row level security;
create policy handover_pack_submissions_all on public.handover_pack_submissions for all using (true) with check (true);

-- Internal working log, but per explicit decision the client CAN see this
-- (read-only) in their own portal, to cut down on back-and-forth.
create table public.handover_gaps_log (
  id uuid primary key default gen_random_uuid(),
  pack_record_id uuid not null references handover_pack_records(id) on delete cascade,
  missing_item text not null,
  impact text,
  owner text,
  due_date date,
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.handover_gaps_log enable row level security;
create policy handover_gaps_log_all on public.handover_gaps_log for all using (true) with check (true);

-- Private bucket -- no public/anon policies added on purpose. Only the
-- service role key (server-side only) can read or write it.
insert into storage.buckets (id, name, public) values ('client-uploads', 'client-uploads', false);

-- Seed the 27-item EWM template from AB-ONB-01 (Client Handover Pack).
-- All 27 included per explicit decision ("I want everything to be
-- plugged in there"), editable afterward from the Manage screen.
insert into public.handover_pack_items (id, section, label, description, sort_order) values
('A1','A. Contract & Terms','Signed SOW','Scope in and out, deliverables, term. The baseline for everything Ops delivers.',1),
('A2','A. Contract & Terms','SLA','Response and turnaround times, how each is measured, exclusions.',2),
('A3','A. Contract & Terms','KPIs and targets','Definitions, formulas, targets, measurement period and data source.',3),
('A4','A. Contract & Terms','Penalties and rewards','Exact triggers and amounts, so Ops knows what is at stake on each KPI.',4),
('A5','A. Contract & Terms','Pricing and billing model','FTE, hourly or transactional; what counts as billable, so tracking supports invoicing.',5),
('A6','A. Contract & Terms','Term, renewal, notice and replacement terms','Replacement lead times, notice periods, termination conditions.',6),
('A7','A. Contract & Terms','NDA and data protection terms','Data handling obligations (e.g. DPA / GDPR where applicable).',7),
('B1','B. Operational Baseline','Volume history','Volume by process and week, including peaks. Basis for the capacity plan.',8),
('B2','B. Operational Baseline','Handling time (AHT) and complexity per process','Validate with time-and-motion before committing to targets.',9),
('B3','B. Operational Baseline','Capacity plan','Required FTE per process, assumptions, peak and attrition buffer.',10),
('B4','B. Operational Baseline','Work schedule and coverage hours','Shifts, time-zone overlap, daily cut-off times.',11),
('B5','B. Operational Baseline','Peak and seasonal calendar','Known peak periods, month-end / year-end, promotions.',12),
('B6','B. Operational Baseline','Holiday calendars','Philippines and client-country holidays and the coverage rule for each.',13),
('C1','C. Process Documentation','SOPs / work instructions','One per in-scope process. Note status: draft, client-approved, or none.',14),
('C2','C. Process Documentation','Process maps / workflows','Trigger, steps and output for each process.',15),
('C3','C. Process Documentation','Sample transactions and exceptions','Real examples including edge cases and who decides on exceptions.',16),
('C4','C. Process Documentation','Quality criteria and error definitions','What counts as an error, how work is sampled and checked.',17),
('C5','C. Process Documentation','Known issues and backlog at takeover','Starting backlog and open items, so they are not blamed on the new team.',18),
('D1','D. Systems & Access','Systems and tools list','Each system, its purpose, and whether client-owned or AB-owned.',19),
('D2','D. Systems & Access','Access request process','Who approves, how requests are made, lead time.',20),
('D3','D. Systems & Access','Access levels per role','Least-privilege access needed for each role.',21),
('D4','D. Systems & Access','Hardware and security requirements','Device specification, VPN, antivirus, restrictions.',22),
('D5','D. Systems & Access','Credential handling rules','How shared logins and MFA are managed and stored.',23),
('E1','E. Reporting & Governance','Report requirements','Which reports, format, frequency, recipient.',24),
('E2','E. Reporting & Governance','Meeting cadence','Daily, weekly, monthly and QBR schedule.',25),
('E3','E. Reporting & Governance','Client contacts','Operational lead, process owner and decision maker.',26),
('E4','E. Reporting & Governance','Client escalation contacts and response expectations','Who we call when something breaks, and how fast they respond.',27),
('E5','E. Reporting & Governance','Change-notification process','How the client tells us about process, volume or system changes.',28),
('F1','F. Onboarding Plan Inputs','Target go-live date and kickoff date','Fixes the 30-60-90 timeline.',29),
('F2','F. Onboarding Plan Inputs','Knowledge-transfer sessions','Who trains us, when, and whether sessions can be recorded.',30),
('F3','F. Onboarding Plan Inputs','Expectations not written in the SOW','Anything the client expects that is not in the contract.',31);
