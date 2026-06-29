-- 1. Add new columns to employees table
alter table employees add column if not exists employee_id text;
alter table employees add column if not exists personal_email text;

-- Create unique index on employee_id (optional but recommended)
create unique index if not exists employees_employee_id_idx on employees(employee_id) where employee_id is not null;

-- 2. Add acknowledgment columns to coaching_logs
alter table coaching_logs add column if not exists initiated_by text default 'Team Lead';
alter table coaching_logs add column if not exists requires_acknowledgment boolean default false;
alter table coaching_logs add column if not exists agent_acknowledged boolean default false;
alter table coaching_logs add column if not exists agent_acknowledged_at timestamptz;
alter table coaching_logs add column if not exists agent_acknowledged_by text;

-- 3. Update existing records to have requires_acknowledgment = false
update coaching_logs set requires_acknowledgment = false where requires_acknowledgment is null;
update coaching_logs set agent_acknowledged = false where agent_acknowledged is null;

-- 4. Pre-populate employee IDs from the uploaded record (update name to match your DB)
-- Run these manually if the names match:
-- update employees set employee_id = 'ABBSS-100044' where name ilike '%Balingit%Jenefer%';
-- update employees set employee_id = 'ABBSS-100045' where name ilike '%Bancud%Jose%';
-- update employees set employee_id = 'ABBSS-100053' where name ilike '%Canoy%Madelyn%';
-- update employees set employee_id = 'ABBSS-100057' where name ilike '%Casimiro%Angelica%';
-- update employees set employee_id = 'ABBSS-100064' where name ilike '%Cleofe%Nelaine%';
-- update employees set employee_id = 'ABBSS-100023' where name ilike '%Cornel%Precilla%';
-- update employees set employee_id = 'ABBSS-100048' where name ilike '%Dandoy%';
-- update employees set employee_id = 'ABBSS-100046' where name ilike '%Flaviano%Jinky%';
-- update employees set employee_id = 'ABBSS-100027' where name ilike '%Gamier%';
-- update employees set employee_id = 'ABBSS-100050' where name ilike '%Graciano%Felma%';
