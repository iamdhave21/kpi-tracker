-- Check all accounts related to the reported issues
select username, role, active, created_at
from app_users
where username ilike '%frances%'
   or username ilike '%wennielyn%'
   or username ilike '%precilla%'
   or username ilike '%recilla%'
order by username;
