select username, role, active, created_at
from app_users
where username ilike '%bancud%' or username ilike '%jose%';
