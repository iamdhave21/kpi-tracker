-- ============================================================
-- Logs the security audit + fixes from this session into Matrix
-- so the full story is part of the permanent record for handoff.
-- ============================================================

insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Issue',
  'Shared changeme123 default password for new employee accounts',
  'Every new employee account auto-created via the Employees page (or via Settings > App Users) received the literal password "changeme123" as a shared, predictable default. Anyone aware of the convention -- now also documented across hundreds of commit messages -- could attempt to log into any account that had not yet changed it. Confirmed via full git history scan (no GitHub tokens, Gmail credentials, or Supabase service role key were ever leaked into the repo -- only the anon key, which is public-facing by design and low risk). Fixed in the same session: see "Forced password change on first login" entry below.',
  'Done',
  'High',
  'system',
  now()
),
(
  'Feature',
  'Forced password change on first login (replaces changeme123)',
  'New accounts now get a unique random 8-character temporary password instead of the shared "changeme123" default. A new must_change_password flag on app_users is set true on account creation (both the Employees-page auto-create path and the Settings > App Users "Create Login" path). The login API returns this flag, and the app shows a forced "Set a New Password" screen before granting any access if true. Successfully changing the password clears the flag. Existing accounts already on changeme123 were checked and none remained at time of fix -- everyone had already changed their password independently. SQL: SECURITY-FIX-forced-password-change.sql.',
  'Done',
  'High',
  'system',
  now()
),
(
  'Issue',
  'Passwords stored and compared as plain text (not actually hashed)',
  'Discovered while auditing the changeme123 issue: app_users.password_hash is NOT an actual cryptographic hash -- the login API does a direct string comparison (user.password_hash !== password). This means anyone with database read access (e.g. via the Supabase dashboard) can see every user''s real password in plain text. This is a real, standing security gap, separate from and larger than the changeme123 fix. Proper fix requires: hashing passwords on creation/change (e.g. bcrypt), updating the login comparison to verify against the hash instead of exact-matching plain text, and migrating all existing plain-text passwords to hashed versions (likely requiring a forced reset for everyone, since old plain-text values cannot be un-hashed retroactively). Flagged for follow-up, not yet started.',
  'Open',
  'High',
  'system',
  now()
),
(
  'Feature',
  'Full git history security scan before handover prep',
  'Scanned all 221+ commits across the project''s full history for leaked secrets before preparing developer handover. Findings: one hardcoded Supabase ANON key found in two now-removed debug files from early in the project (low risk -- anon keys are public-facing by design, protected by RLS policies rather than secrecy). No GitHub personal access tokens, Gmail app passwords, or Supabase service role key were ever found hardcoded into any commit. Recommendation before handover: rotate all secrets anyway (Supabase keys, Gmail app password, GitHub token) since they have been visible across many chat sessions during development, and set up the new developer with their own Supabase/Vercel team member accounts rather than sharing the current shared login.',
  'Done',
  'Medium',
  'system',
  now()
),
(
  'Pending SQL',
  'Schema export queries for handoff documentation',
  'Four queries (SCHEMA-EXPORT-1 through 4) that pull the live, current-state database structure directly from Supabase: all tables/columns, RLS policies, storage buckets, and foreign key relationships. These are meant to be run once and the output compiled into a single clean SCHEMA.md reference document for the new developer, separate from the historical "how we got here" migration SQL files scattered across the repo. Not yet run/compiled as of this entry.',
  'Open',
  'Medium',
  'system',
  now()
);
