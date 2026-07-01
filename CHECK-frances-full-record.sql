-- Check Frances's full record to see if email column is populated
select username, email, role, active, password_hash, must_change_password
from app_users
where username = 'frances.miranda@ab-businesssupport.com';
