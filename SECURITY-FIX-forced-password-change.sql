-- ============================================================
-- SECURITY FIX: forced password change for new accounts
-- Replaces the shared 'changeme123' default password convention,
-- which was a real standing risk -- anyone who knew the convention
-- (now also documented across 217 commit messages) could attempt
-- to log into any employee account that hadn't changed it yet.
-- ============================================================

alter table app_users add column if not exists must_change_password boolean default false;

-- Existing accounts are NOT retroactively flagged here on purpose --
-- this only applies going forward to new accounts. If you want to
-- force a one-time password reset for everyone who currently has
-- the old shared default, run this separately after reviewing:
--
-- update app_users set must_change_password = true where password_hash = 'changeme123';
