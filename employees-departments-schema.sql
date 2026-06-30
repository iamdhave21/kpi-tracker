-- Adds department tagging to employees, used for:
-- 1. Org/department mapping visibility in People > Employees
-- 2. Ticket notification routing (Tickets page -> /api/notify/ticket-created)
--
-- Run this once in Supabase SQL editor.

alter table employees add column if not exists departments text[];

-- Optional: index for the "contains" lookup used by ticket routing
create index if not exists employees_departments_idx on employees using gin (departments);
