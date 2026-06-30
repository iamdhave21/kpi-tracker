-- Run this and send me the full result — this will show us exactly
-- where the mismatch is between your login, your avatar, and the
-- employee record the Org Chart is trying to match against.

select
  'app_users' as source,
  username as email_value,
  avatar_url is not null as has_avatar,
  avatar_url
from app_users
where username ilike '%operations%'

union all

select
  'employees' as source,
  email as email_value,
  null as has_avatar,
  name as avatar_url  -- reusing this column to show the name for this row
from employees
where email ilike '%operations%';
