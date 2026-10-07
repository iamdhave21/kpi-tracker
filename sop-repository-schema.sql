-- SOP and LWI Repository (Operations). Run these THREE blocks one at a time in
-- the Supabase SQL Editor. Each should say "Success. No rows returned".
--
-- SECURITY: like the Client Requests tables, these have row level security ON
-- with NO policies, so the public (anon) key cannot read or write them at all.
-- Every read and write goes through app/api/sop/staff, which verifies the
-- caller's Google sign-in (verifyStaff) first. Files live in the existing
-- PRIVATE 'client-uploads' bucket under sop/<sop_id>/<version_id>/ and are
-- served only through 5-minute signed URLs.
--
-- Model: a document (sop_documents) has many versions (sop_versions). Content
-- "cards" (text / link / file) live on the version as jsonb, so every version
-- is a complete, frozen snapshot. A new version needs re-acknowledgment.

-- ===== BLOCK 1: documents and versions =====
create table public.sop_documents (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  doc_type text not null check (doc_type in ('SOP', 'LWI')),
  department text,
  client text,
  owner_email text,
  owner_name text,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  current_version_id uuid,
  created_by text not null,
  created_by_name text,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index sop_documents_code_unique on public.sop_documents (lower(code));

create table public.sop_versions (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references public.sop_documents(id) on delete cascade,
  version_no int not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'declined', 'superseded')),
  summary text,
  supersedes text,
  cards jsonb not null default '[]'::jsonb,
  receiver_mode text not null default 'all' check (receiver_mode in ('all', 'selected')),
  effectivity_date date,
  next_review_date date,
  approval_date date,
  created_by text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (sop_id, version_no)
);
alter table public.sop_documents
  add constraint sop_documents_current_version_fk
  foreign key (current_version_id) references public.sop_versions(id) on delete set null;

-- ===== BLOCK 2: approvers, selected receivers, acknowledgments =====
create table public.sop_approvals (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.sop_versions(id) on delete cascade,
  approver_email text not null,
  approver_name text,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'declined')),
  comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index sop_approvals_one_per_person on public.sop_approvals (version_id, (split_part(lower(approver_email), '@', 1)));

create table public.sop_receivers (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.sop_versions(id) on delete cascade,
  email text not null,
  name text
);
create unique index sop_receivers_one_per_person on public.sop_receivers (version_id, (split_part(lower(email), '@', 1)));

create table public.sop_acks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.sop_versions(id) on delete cascade,
  email text not null,
  name text,
  acknowledged_at timestamptz not null default now()
);
-- Local part only: the same person can sign in under either company domain.
create unique index sop_acks_one_per_person on public.sop_acks (version_id, (split_part(lower(email), '@', 1)));

-- ===== BLOCK 3: lock the tables (RLS on, deliberately NO policies) =====
alter table public.sop_documents enable row level security;
alter table public.sop_versions enable row level security;
alter table public.sop_approvals enable row level security;
alter table public.sop_receivers enable row level security;
alter table public.sop_acks enable row level security;

-- Verify afterwards (expect 5 rows, all rowsecurity = true, and ZERO policies):
--   select tablename, rowsecurity from pg_tables where tablename like 'sop\_%' order by 1;
--   select tablename, policyname from pg_policies where tablename like 'sop\_%';
