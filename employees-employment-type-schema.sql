-- Adds employment classification to employees, used for:
-- 1. Employees page badges (Manager, Team Lead, Agent, Contractor, Intern, Probationary)
-- 2. Org Chart labeling (shown on each person's card)
--
-- Run this once in Supabase SQL editor.

alter table employees add column if not exists employment_type text default 'Agent';

-- Optional: index if you plan to filter/search by this often
create index if not exists employees_employment_type_idx on employees(employment_type);
