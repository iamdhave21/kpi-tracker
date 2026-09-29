-- Client Portal Phase 2: Go-Live Readiness (AB-ONB-03), internal-only
-- tracking that rolls up into a simple readiness % shown back to the
-- client -- no item names, owners, or internal contacts exposed.
--
-- Ties to the SAME handover_pack_records row created in Phase 1, per
-- explicit decision: "one continuous onboarding record per client," not
-- a new pack handed to the client at each stage. Run once in the
-- Supabase SQL Editor (after client-portal-schema.sql).

create table public.go_live_readiness_items (
  id text primary key,
  section text not null,
  label text not null,
  done_means text,
  critical boolean not null default false,
  sort_order integer not null default 0,
  retired_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.go_live_readiness_items enable row level security;
create policy go_live_readiness_items_all on public.go_live_readiness_items for all using (true) with check (true);

create table public.go_live_readiness_statuses (
  id uuid primary key default gen_random_uuid(),
  pack_record_id uuid not null references handover_pack_records(id) on delete cascade,
  item_id text not null references go_live_readiness_items(id),
  status text not null default 'not_ready' check (status in ('ready','not_ready','in_progress','n_a')),
  evidence text,
  owner text,
  updated_by text,
  updated_at timestamptz not null default now(),
  unique (pack_record_id, item_id)
);
alter table public.go_live_readiness_statuses enable row level security;
create policy go_live_readiness_statuses_all on public.go_live_readiness_statuses for all using (true) with check (true);

-- Seed the 40-item template from AB-ONB-03 -- 29 Critical, 11
-- non-critical, matching the source document's own Readiness Summary
-- count exactly.
insert into public.go_live_readiness_items (id, section, label, done_means, critical, sort_order) values
('A1','A. Contract & Handover','Handover Pack accepted','AB-ONB-01 accepted; every gap closed or accepted by the Ops Director.',true,1),
('A2','A. Contract & Handover','KPIs, SLAs, penalties and rewards confirmed','Definitions and targets confirmed with the client in writing.',true,2),
('A3','A. Contract & Handover','Capacity plan approved','Required FTE agreed internally; assumptions documented.',true,3),
('A4','A. Contract & Handover','Ramp-up targets agreed','Day 30 / 60 / 90 targets agreed with the client (see AB-ONB-04).',false,4),
('B1','B. Workforce','Headcount in place','Staff hired per the capacity plan; contracts signed.',true,5),
('B2','B. Workforce','Account owner assigned','Named Account Manager / Program Manager with capacity for the account.',true,6),
('B3','B. Workforce','Backup identified per role','A trained backup exists for every single-processor task.',true,7),
('B4','B. Workforce','Work schedule published','Coverage hours and holiday coverage confirmed.',false,8),
('B5','B. Workforce','Confidentiality agreements signed','Every person on the account has signed an NDA.',true,9),
('C1','C. Training & Competency','Client-specific training completed','All assigned staff attended.',true,10),
('C2','C. Training & Competency','Assessment passed','Each person passed the process check or test transactions at the agreed pass mark.',true,11),
('C3','C. Training & Competency','Shadowing / nesting completed','Agreed period or transaction count completed under supervision.',false,12),
('C4','C. Training & Competency','SOPs acknowledged','Each person has acknowledged the SOPs.',true,13),
('D1','D. Hardware & Security','Devices issued and configured','Meets the client specification.',true,14),
('D2','D. Hardware & Security','Security baseline met','Antivirus scan submitted in the portal; updates applied; VPN set up if required.',true,15),
('D3','D. Hardware & Security','Connectivity and power continuity','Backup internet and power, or an agreed work-from-home contingency.',true,16),
('D4','D. Hardware & Security','Data protection rules acknowledged','Acceptable-use and data handling rules acknowledged by all staff.',true,17),
('E1','E. Tools & Access','Accounts created for every user','All required systems provisioned.',true,18),
('E2','E. Tools & Access','Access tested','Every user logged in and completed a test action.',true,19),
('E3','E. Tools & Access','Access levels match the approved matrix','Least-privilege access; approvals on file.',true,20),
('E4','E. Tools & Access','Credential handling agreed','Passwords and MFA handling agreed with the client.',true,21),
('E5','E. Tools & Access','Tools inventory updated','New tools added with owner, cost and renewal.',false,22),
('F1','F. Processes & SOPs','SOPs approved','An approved SOP exists for every in-scope process.',true,23),
('F2','F. Processes & SOPs','Client Operations Manual complete','AB-ONB-02 completed and approved.',true,24),
('F3','F. Processes & SOPs','Test transactions completed','Sample run completed and results reviewed with the client.',true,25),
('F4','F. Processes & SOPs','Quality checks defined','Error definitions and sampling agreed.',false,26),
('G1','G. Reporting & Performance Tracking','Daily tracker ready','Volume, output and backlog tracker built and tested.',true,27),
('G2','G. Reporting & Performance Tracking','KPI targets loaded in the portal','Client targets recorded for the account.',true,28),
('G3','G. Reporting & Performance Tracking','First report template agreed','Client has approved the format.',false,29),
('G4','G. Reporting & Performance Tracking','Reporting calendar set','Report and meeting dates scheduled.',false,30),
('H1','H. Escalation & Continuity','Escalation contacts confirmed','Both AB and client contacts confirmed in writing.',true,31),
('H2','H. Escalation & Continuity','Escalation matrix communicated','Staff briefed on levels and triggers.',true,32),
('H3','H. Escalation & Continuity','Account continuity scenarios completed','Manual Section 10 completed; task coverage entered in the portal BCP.',true,33),
('I1','I. Portal Setup','Team and users created','Team under the client name; users added with correct roles.',true,34),
('I2','I. Portal Setup','Operating Cadence items set','Daily, weekly and monthly items assigned to the account owner.',false,35),
('I3','I. Portal Setup','Links and resources added','Client tools, SOPs and documents available in the portal.',false,36),
('I4','I. Portal Setup','30-60-90 checkpoints scheduled','Checkpoint meetings created as Tasks.',false,37),
('J1','J. Client Alignment','Kickoff meeting held','Expectations, contacts and go-live date confirmed.',true,38),
('J2','J. Client Alignment','Client confirms readiness in writing','Written confirmation from the client process owner.',true,39),
('J3','J. Client Alignment','Hypercare plan agreed','Daily check-ins for the first 10 days agreed.',false,40);
