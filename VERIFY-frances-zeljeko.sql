select id, name, email, employee_id, active, departments, client, employment_type
from employees
where email in ('frances.miranda@ab-businesssupport.com', 'zeljeko.yniesta@ab-businesssupport.com')
order by name;
