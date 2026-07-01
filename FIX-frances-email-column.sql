-- Fix Frances's email column (was 'frances@' instead of 'frances.miranda@')
-- Also reset password to changeme123 with must_change_password = true
update app_users
set
  email = 'frances.miranda@ab-businesssupport.com',
  password_hash = 'changeme123',
  must_change_password = true
where username = 'frances.miranda@ab-businesssupport.com';

-- Verify
select username, email, role, active, password_hash, must_change_password
from app_users
where username = 'frances.miranda@ab-businesssupport.com';
