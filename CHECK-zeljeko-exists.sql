select id, name, email, employee_id, active, departments, client
from employees
where name ilike '%zeljeko%' or name ilike '%yniesta%' or name ilike '%ynesta%' or employee_id = 'ABBSS-100065'
order by name;
