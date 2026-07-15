-- Finds every active employee who has a work email set but has NO matching
-- app_users login account (checking both email and username columns, since
-- those have been inconsistent -- see prior fixes this session).
--
-- These are exactly the people who will hit "No account found for..."
-- when trying to upload a photo, use favorites, or in some cases log in
-- at all -- most likely created via "+ Add Employee" before that flow
-- was fixed to create a login automatically.

select e.name, e.email, e.employee_id, e.active
from employees e
where e.active = true
  and e.email is not null
  and not exists (
    select 1 from app_users u
    where lower(u.email) = lower(e.email)
       or lower(u.username) = lower(e.email)
  )
order by e.name;
