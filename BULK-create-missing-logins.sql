-- Creates a login account for every active employee who's missing one.
-- Uses a random, never-communicated placeholder password (must_change_password
-- is true, but more importantly each person will use "Forgot Password" on the
-- login screen afterward -- that's cleaner than you manually distributing 19
-- separate temp passwords).
--
-- Everyone created here defaults to the 'agent' portal role. If anyone in
-- this list should actually be a Team Lead/Admin, adjust their role in
-- Employees after this runs (editing there now correctly syncs to their
-- login, per the fix from earlier this session).

insert into app_users (username, email, name, role, password_hash, must_change_password, active)
select
  e.email,
  e.email,
  e.name,
  'agent',
  crypt(encode(gen_random_bytes(16), 'hex'), gen_salt('bf', 12)),
  true,
  true
from employees e
where e.active = true
  and e.email is not null
  and not exists (
    select 1 from app_users u
    where lower(u.email) = lower(e.email)
       or lower(u.username) = lower(e.email)
  );

-- Sanity check afterward -- should return 0 rows if everyone now has a login:
-- select e.name, e.email from employees e
-- where e.active = true and e.email is not null
-- and not exists (select 1 from app_users u where lower(u.email)=lower(e.email) or lower(u.username)=lower(e.email));
