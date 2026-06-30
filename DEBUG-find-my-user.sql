-- Show all app_users rows so we can find which one is actually yours
-- (the previous query found zero matches for 'operations', so let's see
-- everything and identify the real username)

select id, username, role, active, avatar_url is not null as has_avatar, created_at
from app_users
order by created_at;
