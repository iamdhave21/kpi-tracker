-- Auto-apply Employee IDs from ABBSS Employee Record export
-- Run in Supabase SQL Editor

-- First ensure the column exists
alter table employees add column if not exists employee_id text;
alter table employees add column if not exists personal_email text;

-- Apply IDs by matching last name (case-insensitive)
-- Active/contractual employees first
update employees set employee_id = 'ABBSS-100044' where name ilike '%Balingit%' and employee_id is null;
update employees set employee_id = 'ABBSS-100045' where name ilike '%Bancud%' and employee_id is null;
update employees set employee_id = 'ABBSS-100053' where name ilike '%Canoy%' and employee_id is null;
update employees set employee_id = 'ABBSS-100057' where name ilike '%Casimiro%' and employee_id is null;
update employees set employee_id = 'ABBSS-100064' where name ilike '%Cleofe%' and employee_id is null;
update employees set employee_id = 'ABBSS-100023' where name ilike '%Cornel%' and employee_id is null;
update employees set employee_id = 'ABBSS-100048' where name ilike '%Dandoy%' and employee_id is null;
update employees set employee_id = 'ABBSS-100046' where name ilike '%Flaviano%' and employee_id is null;
update employees set employee_id = 'ABBSS-100027' where name ilike '%Gamier%' and employee_id is null;
update employees set employee_id = 'ABBSS-100050' where name ilike '%Graciano%' and employee_id is null;
update employees set employee_id = 'ABBSS-100059' where name ilike '%Dela Cruz%' and employee_id is null;

-- Resigned employees (still useful to have on record)
update employees set employee_id = 'ABBSS-100010' where name ilike '%Alimpolos%' and employee_id is null;
update employees set employee_id = 'ABBSS-100018' where name ilike '%Aquino%' and name ilike '%Dianne%' and employee_id is null;
update employees set employee_id = 'ABBSS-100021' where name ilike '%Artiaga%' and employee_id is null;
update employees set employee_id = 'ABBSS-100043' where name ilike '%Austria%' and employee_id is null;
update employees set employee_id = 'ABBSS-100011' where name ilike '%Camartin%' and employee_id is null;
update employees set employee_id = 'ABBSS-100033' where name ilike '%Cueto%' and employee_id is null;
update employees set employee_id = 'ABBSS-100025' where name ilike '%De Leon%' and name ilike '%Janet%' and employee_id is null;
update employees set employee_id = 'ABBSS-100026' where name ilike '%Delos Santos%' and name ilike '%Mary Joy%' and employee_id is null;
update employees set employee_id = 'ABBSS-100052' where name ilike '%Delos Santos%' and name ilike '%Rowelle%' and employee_id is null;

-- Dadulla (multiple people with same last name - match by first name)
update employees set employee_id = 'ABBSS-100024' where name ilike '%Dadulla%' and name ilike '%Monica%' and employee_id is null;
update employees set employee_id = 'ABBSS-100031' where name ilike '%De Guzman%' and employee_id is null;

-- Verify what was updated
select name, employee_id from employees where employee_id is not null order by name;
