-- Renames the 4 confirmed-match logins from short handles to real emails.
-- Role, password, and any saved avatar carry over automatically since
-- this updates the existing row rather than creating a new one.

update app_users set username = 'andrealiz@ab-businesssupport.com' where username = 'andrealiz';
update app_users set username = 'azeliza.ignacio@ab-businesssupport.com' where username = 'azeliza.ignacio';
update app_users set username = 'precilla.cornel@ab-businesssupport.com' where username = 'precilla.cornel';
update app_users set username = 'wennielyn.pungasi@ab-businesssupport.com' where username = 'wennielyn.pungasi';

-- Verify — should show all 4 with their new email usernames
select username, role, active from app_users
where username in (
  'andrealiz@ab-businesssupport.com',
  'azeliza.ignacio@ab-businesssupport.com',
  'precilla.cornel@ab-businesssupport.com',
  'wennielyn.pungasi@ab-businesssupport.com'
)
order by username;
