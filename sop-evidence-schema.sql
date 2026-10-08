-- SOP Repository, part 2: approval proof (screenshots of the client or POC
-- approving), the process change log, and the page edit log. Run these THREE
-- blocks one at a time in the Supabase SQL Editor. Each should say
-- "Success. No rows returned".
--
-- Same security model as part 1: RLS ON with NO policies. Everything goes
-- through app/api/sop/staff. Proof files live in the private 'client-uploads'
-- bucket under sop/ and are only reachable through 5-minute signed URLs.
--
-- Evidence is append-only by design: proof and change entries are never
-- edited after saving (a correction is a new entry); only an Admin can delete
-- one, and the deletion is written to sop_edits.

-- ===== BLOCK 1: how a version was approved + approval proof =====
alter table public.sop_versions
  add column approval_source text not null default 'internal' check (approval_source in ('internal', 'external'));

create table public.sop_approval_proofs (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references public.sop_documents(id) on delete cascade,
  version_id uuid not null references public.sop_versions(id) on delete cascade,
  approved_by_name text not null,
  approved_by_role text,
  approved_on date not null,
  method text not null default 'email' check (method in ('email', 'chat', 'call', 'meeting', 'other')),
  note text,
  attachments jsonb not null default '[]'::jsonb,
  added_by text not null,
  added_by_name text,
  created_at timestamptz not null default now()
);
create index sop_approval_proofs_version on public.sop_approval_proofs (version_id);

-- ===== BLOCK 2: process change log + edit log =====
create table public.sop_changes (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references public.sop_documents(id) on delete cascade,
  version_id uuid not null references public.sop_versions(id) on delete cascade,
  summary text not null,
  previous_text text,
  reason text,
  requested_by text,
  requested_by_role text,
  requested_on date,
  effective_date date,
  approval_path text not null check (approval_path in ('already_approved', 'needs_approval')),
  request_ref text,
  added_by text not null,
  added_by_name text,
  created_at timestamptz not null default now()
);
create index sop_changes_doc on public.sop_changes (sop_id);

-- Every small edit to an approved page, with the content as it was BEFORE.
create table public.sop_edits (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references public.sop_documents(id) on delete cascade,
  version_id uuid references public.sop_versions(id) on delete cascade,
  note text not null,
  cards_before jsonb not null default '[]'::jsonb,
  edited_by text not null,
  edited_by_name text,
  created_at timestamptz not null default now()
);
create index sop_edits_doc on public.sop_edits (sop_id, created_at desc);

-- ===== BLOCK 3: lock the new tables (RLS on, deliberately NO policies) =====
alter table public.sop_approval_proofs enable row level security;
alter table public.sop_changes enable row level security;
alter table public.sop_edits enable row level security;

-- Verify afterwards (expect 8 rows total, all true, and ZERO policies):
--   select tablename, rowsecurity from pg_tables where tablename like 'sop\_%' order by 1;
--   select tablename, policyname from pg_policies where tablename like 'sop\_%';
