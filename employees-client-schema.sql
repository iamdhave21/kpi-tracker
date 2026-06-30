-- Adds client-account tagging to employees, used for:
-- 1. Employees page badges (EMMA, AB BSS, Harlan + Holden)
-- 2. Org Chart labeling (shown on each person's card)
-- 3. Export to Excel (new "Client" column)
--
-- Note: since each role/designation is its own row in `employees` (multi-role
-- support), client is set per-role, same as designation. A person supporting
-- multiple clients just has multiple rows, same pattern as multiple designations.
--
-- Run this once in Supabase SQL editor.

alter table employees add column if not exists client text default 'AB BSS';

create index if not exists employees_client_idx on employees(client);
