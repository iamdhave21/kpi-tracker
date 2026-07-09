-- Closes the exposure window for any app_users rows created via the old
-- add-user route, which stored passwords in plain text until the person's
-- first login (the login route auto-upgrades on successful login, but
-- until then the plain-text password sits in the database).
--
-- pgcrypto's crypt() with gen_salt('bf', ...) produces standard bcrypt
-- hashes (the same $2a$/$2b$ format bcryptjs uses), so anything hashed
-- here will verify correctly against the app's existing bcrypt.compare()
-- calls -- no app code changes needed for this migration to take effect.

create extension if not exists pgcrypto;

update app_users
set password_hash = crypt(password_hash, gen_salt('bf', 12))
where password_hash is not null
  and password_hash not like '$2a$%'
  and password_hash not like '$2b$%';

-- Sanity check afterward -- should return 0 rows.
-- select id, username from app_users where password_hash not like '$2a$%' and password_hash not like '$2b$%';
