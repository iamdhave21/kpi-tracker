update app_users set username = 'frances.miranda@ab-businesssupport.com' where username = 'frances.miranda';
update app_users set username = 'zeljeko.yniesta@ab-businesssupport.com' where username = 'zeljeko.yniesta';

-- Verify — should show 2 rows with the new email usernames
select username, role, active from app_users
where username in ('frances.miranda@ab-businesssupport.com', 'zeljeko.yniesta@ab-businesssupport.com')
order by username;
