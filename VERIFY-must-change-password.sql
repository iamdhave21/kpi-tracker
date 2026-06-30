-- Confirm the column exists
select column_name from information_schema.columns
where table_name = 'app_users' and column_name = 'must_change_password';

-- Confirm how many accounts actually got flagged
select username, role, must_change_password
from app_users
where must_change_password = true
order by username;
