-- For each app_users account with a non-email username, try to find
-- their real email by matching against the employees table.
-- This won't guess — it shows possible matches so we can verify before
-- changing anything.

select
  u.username as current_login,
  u.role,
  e.name as employee_name,
  e.email as employee_email
from app_users u
left join employees e
  on (
    -- try matching the username against the email prefix (before the @)
    lower(split_part(e.email, '@', 1)) = lower(u.username)
    or lower(replace(e.email, ' ', '')) ilike '%' || lower(replace(u.username, '.', '')) || '%'
  )
where u.active = true
and u.username not like '%@%'
order by u.username;
