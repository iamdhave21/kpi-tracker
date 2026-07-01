-- Frances Miranda's account exists with Manager role but is Inactive.
-- Activating it so she gets proper Manager access when she logs in.
update app_users
set active = true
where username = 'frances.miranda@ab-businesssupport.com';

-- Verify
select username, role, active from app_users
where username = 'frances.miranda@ab-businesssupport.com';
