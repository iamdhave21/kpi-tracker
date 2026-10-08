-- Bonus Review (Super Admin). Run these blocks ONE AT A TIME in the Supabase SQL Editor.
-- Each should say "Success. No rows returned". Then run the check at the bottom.
--
-- SECURITY: the two new tables have row level security ON with NO policies, so the public
-- key cannot read or write them. Everything goes through /api/bonus/staff, which only lets the
-- verified Super Admin in.

-- ===== BLOCK 1: a hire date on each employee (tenure comes from this) =====
alter table public.employees add column if not exists hire_date date;

-- ===== BLOCK 2: saved presets and saved runs =====
create table if not exists public.bonus_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  config jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bonus_presets_name_unique on public.bonus_presets (lower(name));
create table if not exists public.bonus_runs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  config jsonb not null,
  overrides jsonb not null default '{}'::jsonb,
  results jsonb not null,
  totals jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now()
);

-- ===== BLOCK 3: lock both tables (RLS on, deliberately NO policies) =====
alter table public.bonus_presets enable row level security;
alter table public.bonus_runs enable row level security;

-- ===== BLOCK 4: hire dates, first half =====
update public.employees e set hire_date = v.d::date
from (values
  ('%latimer, azeliza%', '2022-12-28'), ('%padua, katrina%', '2022-12-28'), ('%czarina%', '2023-10-15'),
  ('%cornel, precilla%', '2023-10-15'), ('%ramos%cristina%', '2024-01-09'), ('%siggaoat%', '2024-04-24'),
  ('%mu_ez, rose%', '2024-04-24'), ('%czareena%', '2024-06-20'), ('%suing%', '2024-10-18'),
  ('%latupan, norbert%', '2024-11-04'), ('%molina, glo%', '2025-07-30'), ('%dandoy%', '2025-08-11')
) as v(p, d)
where e.active and e.name ilike v.p;

-- ===== BLOCK 5: hire dates, second half (Jennelyn Lopez is 2026) =====
update public.employees e set hire_date = v.d::date
from (values
  ('%lopez, jennelyn%', '2026-08-12'), ('%graciano%', '2025-11-05'), ('%canoy%', '2025-12-04'),
  ('%bancud%', '2026-05-14'), ('%lamarca%', '2026-06-09'), ('%cleofe%', '2026-06-10'),
  ('%balcueva%', '2026-07-29'), ('%barro%', '2026-07-29'), ('%lunca%', '2026-08-10'),
  ('%duterte%', '2026-08-10'), ('%garcia, ken%', '2026-10-01')
) as v(p, d)
where e.active and e.name ilike v.p;

-- ===== CHECK (expect: tables 2, locked 2, policies 0, hire_dates 23 or a little more if a person has two rows) =====
--   select
--    (select count(*) from pg_tables where schemaname='public' and tablename like 'bonus\_%') as tables,
--    (select count(*) from pg_tables where schemaname='public' and tablename like 'bonus\_%' and rowsecurity) as locked,
--    (select count(*) from pg_policies where tablename like 'bonus\_%') as policies,
--    (select count(*) from public.employees where hire_date is not null) as hire_dates;
