-- ============================================================
-- Account fixes - July 1 2026
-- ============================================================

-- 1. Frances Miranda: no app_users record at all -- create it with
--    correct role (admin = Manager) and her correct email
insert into app_users (username, email, password_hash, role, active, must_change_password)
values (
  'frances.miranda@ab-businesssupport.com',
  'frances.miranda@ab-businesssupport.com',
  'changeme123',
  'admin',
  true,
  true
)
on conflict (username) do update set role = 'admin', active = true;

-- 2. Wennielyn Pungasi: no app_users record -- create it with
--    correct username (wennielyn.pungasi, not wennielyn)
insert into app_users (username, email, password_hash, role, active, must_change_password)
values (
  'wennielyn.pungasi@ab-businesssupport.com',
  'wennielyn.pungasi@ab-businesssupport.com',
  'changeme123',
  'admin',
  true,
  true
)
on conflict (username) do update set role = 'admin', active = true;

-- 3. Delete the stale/wrong email entries if they exist
delete from app_users where username = 'recilla@ab-businesssupport.com';
delete from app_users where username = 'wennielyn@ab-businesssupport.com';

-- Verify final state
select username, role, active, must_change_password
from app_users
where username ilike '%frances%'
   or username ilike '%wennielyn%'
   or username ilike '%precilla%'
order by username;
