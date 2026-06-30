-- The auto-match missed these 3 — let's search more loosely to see if
-- they actually exist under a different email format, or if they're
-- truly not in Employees yet.

select name, email, employee_id from employees
where name ilike '%miranda%' or name ilike '%frances%'
order by name;

select name, email, employee_id from employees
where name ilike '%yniesta%' or name ilike '%zeljeko%' or name ilike '%josh%'
order by name;
