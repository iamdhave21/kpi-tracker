-- Renames Dhave's login username from the old short handle 'dhave'
-- to the real email 'operations@ab-businesssupport.com'.
-- Role (super_admin), password, and avatar all carry over automatically
-- since this updates the existing row rather than creating a new one.

update app_users
set username = 'operations@ab-businesssupport.com'
where username = 'dhave';

-- Verify — should show exactly 1 row, with role = super_admin
select id, username, role, active from app_users where username = 'operations@ab-businesssupport.com';
