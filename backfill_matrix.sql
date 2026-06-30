-- Backfills Matrix with the complete commit history of this project
-- (216 commits, June 27-30 2026), so Matrix reflects the full build
-- footprint rather than starting from today.
-- Safe to re-run: skips any title that's already in dev_matrix.

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'Matrix moved out of Settings into its own SYSTEM sidebar item', 'Root cause of ''Matrix not showing up'' across this entire session: the
corrupted NEXT_PUBLIC_SUPABASE_URL environment variable in Vercel was
breaking every Supabase request app-wide. The Matrix code, role check,
and database table were all correct the whole time -- confirmed via a
temporary debug banner showing userRole = ''super_admin'' rendering
correctly once the URL was fixed and redeployed. Debug banner now removed.

Per Dhave''s handoff-readiness request: Matrix is now its own top-level
item directly under SYSTEM (sibling to Settings, not a tab inside it),
so a future point of contact can find the build/issue tracker without
needing to know to look inside Settings tabs first. Gated to Super Admin
and Manager only, same access rule as before. Kept the name ''Matrix'' as
requested. [commit fa08454]', 'Done', 'Medium', 'system', '2026-06-30T09:08:02+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Matrix moved out of Settings into its own SYSTEM sidebar item' and created_at = '2026-06-30T09:08:02+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'temporary visible userRole readout on Settings page to diagnose missing Matrix tab', 'Adds a yellow debug banner showing the exact runtime value and character
length of userRole at the point the Settings tabs render. This will be
removed once we''ve confirmed why the Matrix tab condition isn''t matching
for Dhave despite the database confirming role = super_admin. [commit 4172015]', 'Done', 'Medium', 'system', '2026-06-30T08:57:29+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'temporary visible userRole readout on Settings page to diagnose missing Matrix tab' and created_at = '2026-06-30T08:57:29+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'notification email when any field on an Employees record changes', 'People > Employees: saving an edit now compares the old vs new values
across Name, Work Email, Employee ID, Role, Client Supported, and
Department(s), builds a list of exactly what changed, and emails that
to whatever address is on the record — regardless of whether that
person has portal login access.

This covers Jose Bancud''s actual use case: records-only employees with
no app_users login can still get notified about changes to their record,
since the email goes to employees.email directly rather than requiring
an app_users row to exist.

New API route: /api/notify/employee-updated — sends a clean before/after
table per changed field. Failure to send surfaces a toast error (same
pattern just fixed for role-changed and team-change) instead of failing
silently. [commit 531fedd]', 'Done', 'Medium', 'system', '2026-06-30T08:13:27+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'notification email when any field on an Employees record changes' and created_at = '2026-06-30T08:13:27+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'surface notification email failures instead of silently swallowing them', 'Both changeUserRole and notifyTeamChange used .catch(() => {}) on the
fetch call, which silently discarded any error — network failure, the
API route returning a 500 (e.g. Gmail env vars not configured), anything.
This is exactly why Jose Bancud''s role-change email failed with zero
visible indication of why.

Now both check response.ok and surface a clear toast error if the email
failed to send, while still keeping the underlying DB change (role/team
update) intact regardless. This won''t fix a misconfigured Gmail
connection by itself, but it makes the failure visible so it can
actually be diagnosed instead of looking like nothing happened. [commit 1a9737e]', 'Done', 'Medium', 'system', '2026-06-30T08:08:23+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'surface notification email failures instead of silently swallowing them' and created_at = '2026-06-30T08:08:23+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'rename Frances and Zeljeko''s logins to their newly-added real emails', 'Both were just added to Employees with frances.miranda@ab-businesssupport.com
and zeljeko.yniesta@ab-businesssupport.com — exact match to their existing
short app_users usernames, so this completes the last 2 of the original
7 non-email logins. All app_users accounts (except the generic ''admin'')
now use real emails, so role-change and team-change notifications will
deliver for everyone. [commit 0dd4bee]', 'Done', 'Medium', 'system', '2026-06-30T08:01:54+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'rename Frances and Zeljeko''s logins to their newly-added real emails' and created_at = '2026-06-30T08:01:54+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'Add Employee form had no duplicate check at all', 'Root cause of the Zeljeko ''No employees found but he''s already added''
confusion: addEmployee() blindly inserted whatever was typed, with zero
check against existing records. Same Employee ID or email could be
entered any number of times, creating silent duplicates.

Fix: check Employee ID first (most reliable unique identifier per
Dhave''s request), then email, before inserting. If either already
belongs to someone, show a clear error naming who it belongs to and
stop — no duplicate gets created. People supporting multiple roles
still work fine since that flow doesn''t reuse the same Employee ID. [commit 09b369c]', 'Done', 'Medium', 'system', '2026-06-30T07:58:27+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add Employee form had no duplicate check at all' and created_at = '2026-06-30T07:58:27+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'rename 4 confirmed-match logins to their real emails', 'andrealiz, azeliza.ignacio, precilla.cornel, wennielyn.pungasi -> their
actual @ab-businesssupport.com emails, matched and confirmed against
their Employees records before renaming. Role-change and team-change
notification emails will now actually deliver for these 4 people. [commit 770a409]', 'Done', 'Medium', 'system', '2026-06-30T07:50:30+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'rename 4 confirmed-match logins to their real emails' and created_at = '2026-06-30T07:50:30+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'loose search for frances.miranda and zeljeko.yniesta in employees', 'debug: loose search for frances.miranda and zeljeko.yniesta in employees [commit 7efa891]', 'Done', 'Medium', 'system', '2026-06-30T07:50:17+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'loose search for frances.miranda and zeljeko.yniesta in employees' and created_at = '2026-06-30T07:50:17+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'query to match non-email usernames against employees table for safe rename', 'debug: query to match non-email usernames against employees table for safe rename [commit f7efe89]', 'Done', 'Medium', 'system', '2026-06-30T07:49:01+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'query to match non-email usernames against employees table for safe rename' and created_at = '2026-06-30T07:49:01+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'notification emails for role changes and team add/remove', 'Role change:
- Settings > App Users: role badge is now an editable dropdown for
  Super Admin (any role) and Manager (any role except super_admin/admin)
  Previously there was no way to change a role after account creation at all.
- Changing someone''s role now emails them directly with old role -> new role
  and who made the change
- New API route: /api/notify/role-changed

Team add/remove:
- Adding a member to a team now emails the employee + that team''s lead
  (skips the lead if they don''t have an email on file, or if they''re the
  same person being added/removed)
- Removing a member does the same, with ''removed'' phrasing
- New API route: /api/notify/team-change
- TeamManager''s loadTeams query updated to fetch team_lead.email and
  employee.email so the notifications have what they need

Per spec: role changes notify the employee only (no lead/manager cc''d,
since role changes aren''t team-scoped). Team add/remove notifies both
the employee and that specific team''s lead. [commit fc58dc5]', 'Done', 'Medium', 'system', '2026-06-30T07:39:50+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'notification emails for role changes and team add/remove' and created_at = '2026-06-30T07:39:50+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'Org Chart now uses full screen width, no max-width cap', 'Was previously capped at max-w-[1600px], which still left visible empty
space on wider monitors. Now uses w-full with just the standard padding,
so it scales to fill whatever width the screen actually has. Grid stays
at up to 4 columns (md:2, lg:3, xl:4) so individual team cards don''t get
too cramped on ultra-wide displays. All other pages unaffected, still
max-w-6xl mx-auto as before. [commit f54578a]', 'Done', 'Medium', 'system', '2026-06-30T07:28:31+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Org Chart now uses full screen width, no max-width cap' and created_at = '2026-06-30T07:28:31+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'rename Dhave''s login username from ''dhave'' to operations@ab-businesssupport.com', 'Resolves the Org Chart photo mismatch and aligns the login with the
employee record''s email going forward, per Dhave''s decision to keep
operations@ab-businesssupport.com as the one Super Admin login. [commit 9d848e0]', 'Done', 'Medium', 'system', '2026-06-30T07:22:44+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'rename Dhave''s login username from ''dhave'' to operations@ab-businesssupport.com' and created_at = '2026-06-30T07:22:44+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'photo upload silently ''succeeded'' even when zero rows were updated', 'Root cause found via diagnostic queries: Dhave''s actual login username in
app_users is ''dhave'' (short handle, from the original password-auth system
before usernames became full emails), not an email address. The Org Chart''s
photo lookup matches by email field on the employees table, so it could
never have matched regardless of RLS.

Separately, has_avatar was confirmed false in the database even after the
upload appeared to succeed in the UI. Cause: .update().eq() in Supabase
returns no error when zero rows match the filter — it just silently
updates nothing. The code only checked for an error, not whether any row
was actually affected, so a mismatched username would show ''Photo
updated!'' while saving nothing.

Fix: added .select() to the update call so Supabase returns the affected
row(s). If zero rows come back, we now throw a clear error explaining the
account couldn''t be matched, instead of falsely reporting success. [commit 1670e83]', 'Done', 'Medium', 'system', '2026-06-30T07:14:28+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'photo upload silently ''succeeded'' even when zero rows were updated' and created_at = '2026-06-30T07:14:28+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'list all app_users to find Dhave''s actual login username', 'debug: list all app_users to find Dhave''s actual login username [commit 88b7ad2]', 'Done', 'Medium', 'system', '2026-06-30T07:12:38+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'list all app_users to find Dhave''s actual login username' and created_at = '2026-06-30T07:12:38+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'add diagnostic query for Org Chart photo mismatch on David/Dhave Latimer record', 'debug: add diagnostic query for Org Chart photo mismatch on David/Dhave Latimer record [commit d57696e]', 'Done', 'Medium', 'system', '2026-06-30T07:11:24+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'add diagnostic query for Org Chart photo mismatch on David/Dhave Latimer record' and created_at = '2026-06-30T07:11:24+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'avatars storage RLS policy didn''t account for anon-role requests', 'Password-login users never get a real Supabase Auth session (only Google
OAuth users do), so they upload as the ''anon'' role rather than
''authenticated''. The previous storage policies didn''t explicitly grant
that role, causing ''new row violates row-level security policy'' on upload.

FIX-avatars-rls.sql drops and recreates the policies, explicitly targeting
both anon and authenticated roles for select/insert/update/delete on the
avatars bucket. [commit 06e98e3]', 'Done', 'Medium', 'system', '2026-06-30T07:01:54+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'avatars storage RLS policy didn''t account for anon-role requests' and created_at = '2026-06-30T07:01:54+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'add soft-launch readiness verification SQL', 'Single query to check every table, storage bucket, and key column built
across this entire project against what''s actually live in Supabase.
Returns EXISTS/MISSING for each so we know precisely what''s safe to demo
to testers and what still needs setup before a soft launch. [commit e4f992a]', 'Done', 'Medium', 'system', '2026-06-30T06:57:06+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'add soft-launch readiness verification SQL' and created_at = '2026-06-30T06:57:06+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'BCP (Business Continuity Planning) page under Operations', 'New ''BCP'' nav item under Operations, visible to everyone, edit access for
Super Admin/Manager/Team Lead:

Task List as the primary view:
- Each task has a title, category (Onboarding/Payroll/Recruitment/Client
  Management/Finance/IT/HR/Other), and optional description
- Categorized with color-coded badges, searchable, filterable by category
- Each task shows a coverage count badge: ''3 trained'' (green) or
  ''⚠ No one trained'' (red) so gaps are visible at a glance without
  expanding anything

Click a task to expand -> shows who''s trained:
- Managers/TLs/Admins see a clickable roster of all active employees;
  click anyone to toggle them on/off the task''s trained list (green
  checkmark + highlight when trained)
- Agents see a read-only list of who''s currently trained on that task
- People are de-duplicated by name in the roster picker, since multi-role
  employees share one person across several  rows

SQL: bcp-schema.sql creates bcp_tasks + bcp_task_coverage (many-to-many
join table), with 3 example starter tasks (Onboarding, Payroll cutoff,
Candidate interview) to seed the page so it''s not empty on first load. [commit 63563ea]', 'Done', 'Medium', 'system', '2026-06-30T06:51:12+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'BCP (Business Continuity Planning) page under Operations' and created_at = '2026-06-30T06:51:12+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'add missing SQL for avatar_url column, avatars bucket, dev_matrix table', 'Root cause of both reported bugs (''photo not updating'', ''matrix doesn''t
show up'') was the same: the SQL needed to support these features was
provided in chat across earlier sessions but never actually executed in
Supabase. The app code was correct; the underlying tables/columns/bucket
just didn''t exist yet.

FIX-photo-and-matrix.sql consolidates everything needed in one safe-to-rerun
script:
- app_users.avatar_url column
- ''avatars'' storage bucket (public) + read/insert/update policies
- dev_matrix table + RLS policies + seeded with the one resolved issue

Includes verification queries at the bottom to confirm both fixes landed. [commit 8e48806]', 'Done', 'Medium', 'system', '2026-06-30T06:47:51+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'add missing SQL for avatar_url column, avatars bucket, dev_matrix table' and created_at = '2026-06-30T06:47:51+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'profile photo upload on Home page + Org Chart sizing/width', 'Photo upload (the real bug):
- Root cause: the Employees-page upload control only rendered if the
  employee row''s ''email'' field was non-empty. If that field was ever blank
  for any role-row, the click target silently didn''t render — no error,
  nothing to click. This is why it wasn''t visible.
- Fix: added a new ''My Profile'' card at the top of the Home page that
  uploads/reads using the actual login email (currentUser), which is
  always reliable since it comes straight from the Supabase auth session,
  not the Employees table. Click your own photo, done.
- Card shows your name + a hint, photo updates instantly, same 2MB limit
  and storage bucket as everywhere else for consistency
- The Employees-row upload control (for managers setting others'' photos)
  stays as a secondary path but is no longer the only way to do this

Org Chart sizing/width:
- Content area now uses max-w-[1600px] specifically for Org Chart
  (was max-w-6xl like every other page) — uses the full screen instead of
  leaving large empty margins on the right
- Grid now goes up to 4 columns on extra-wide screens (was capped at 3)
- Team Lead/Manager card is now visibly larger (48px avatar, bigger text,
  more padding) to stand out from the team
- Regular Agent/member cards are unchanged in size, exactly as before [commit 6dbe67b]', 'Done', 'Medium', 'system', '2026-06-30T06:38:31+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'profile photo upload on Home page + Org Chart sizing/width' and created_at = '2026-06-30T06:38:31+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'ticket status visible without expanding + employee photo upload (Org Chart avatars)', 'Tickets fix:
- Status buttons (Open/In Progress/Resolved/Closed) now always visible on
  the collapsed ticket card, not hidden behind a click-to-expand
- Added explicit ''▼ View details / ▲ Hide details'' label so it''s clear
  expanding still does something (shows description + attachments)
- Resolves the discoverability bug logged in Matrix this session

Photo upload (People > Employees + Org Chart):
- Clickable avatar on every employee row — hover shows a camera icon,
  click to upload/change photo (2MB max, any image type)
- Managers/Admins/TLs can set anyone''s photo; an Agent can also set their
  own photo on their own row
- Photo storage reuses the existing ''avatars'' Supabase bucket and
  app_users.avatar_url column (same one used by the Settings profile
  picture) — no new schema needed, since photos are tied to the login
  (app_users), not the per-role employees row, which makes sense since
  multi-role people share one face
- If an employee doesn''t have a portal login yet, upload now shows a
  clear message telling the admin to grant access first (previously
  would have silently failed to save)
- Org Chart: PersonCard now shows the real photo when available, falling
  back to the colored initial tile exactly as before when there''s no photo
  (both Team Lead and member cards) [commit 5d6bed3]', 'Done', 'Medium', 'system', '2026-06-30T06:26:15+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'ticket status visible without expanding + employee photo upload (Org Chart avatars)' and created_at = '2026-06-30T06:26:15+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Matrix page (Settings) — build tracker for features/issues/pending SQL', 'New ''Matrix'' tab in Settings, visible only to Super Admin and Manager:
- Three categories: Feature, Issue, Pending SQL
- Status flow: Open -> In Progress -> Done, with priority (Low/Medium/High)
- Filter by category and status, color-coded badges throughout
- Anyone with access can add an item with a title + optional description,
  and update status directly from the list (no need to message back and forth
  about what''s outstanding)
- This becomes the persistent place to flag fixes needed, and doubles as
  living documentation of what''s shipped for any future dev handoff

Pre-populated with one real issue found during this session''s codebase audit:
ticket status-update controls are hidden behind a click-to-expand interaction
with no visual cue, which is why it looked broken/missing earlier.

SQL: dev-matrix-schema.sql creates the table + seeds that first issue. [commit d4ae35a]', 'Done', 'Medium', 'system', '2026-06-30T06:17:53+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Matrix page (Settings) — build tracker for features/issues/pending SQL' and created_at = '2026-06-30T06:17:53+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Employees is now the single source of truth for App Users (fixes bounced emails)', 'Root cause of ''Mail Delivery Subsystem'' bounces:
- Add User form previously let admins free-type ANY email address, with no
  validation against real employee records. A typo or guessed email would
  silently create a broken login + a guessed employee record.

Fix — Settings > User Manager:
- Removed the hardcoded 31-person EMPLOYEE_MASTERLIST entirely (was a stopgap
  before Employees had real data — no longer needed)
- Add User form now shows a DROPDOWN of existing active Employees who have a
  work email on file and don''t already have a login — no free-text email entry
- Selecting an employee shows a confirmation card with their name, Employee ID,
  and the exact email that will be used — eliminates any chance of typos
- Deduped by email so multi-role employees (same person, multiple rows) only
  appear once in the dropdown
- Empty state guides admin to add the person under People > Employees first
  if they''re not in the dropdown yet (mentioning a person who isn''t an
  employee can no longer get a login, which was the actual ask)

Role renaming (display labels only, DB keys unchanged so nothing else breaks):
- ''Admin'' -> ''Manager'' (admin)
- ''Viewer'' -> ''Agent'' (viewer)
- ''Team Lead'' and ''Super Admin'' unchanged
- New shared ROLE_LABELS constant used in: sidebar profile, Settings user list,
  preview-as banner (''Viewing as Manager'', ''Preview as Agent''), and the
  new-user email notification

Kept as requested: Audit Log and Change Password remain in Settings as a
login fallback alongside Google OAuth, since OAuth has already had real
hiccups (redirect/config issues) and password login keeps people working
when that happens. [commit 9954793]', 'Done', 'Medium', 'system', '2026-06-30T06:10:27+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Employees is now the single source of truth for App Users (fixes bounced emails)' and created_at = '2026-06-30T06:10:27+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'remove manual Designation field, auto-generate from Role+Client; rename Employment Type to Role', 'Employees page:
- Designation is no longer a manually-typed field — removed from Add Employee
  form and both edit panels (single + multi-role)
- New generateDesignation() helper auto-builds the internal tag as
  ''{Role}_{Client}'' (e.g. ''Manager_Harlan + Holden''), deduping with (2), (3)
  suffixes if a person already has another role with the same Role+Client combo
- Designation still exists in the data model under the hood — KPI records,
  multi-role grouping, Org Chart, and Teams dropdowns all still key off it,
  so nothing breaks. It''s just derived now instead of typed.
- ''Employment Type'' label renamed to ''Role'' throughout (Add form, edit panels,
  Excel export) — underlying field name (employment_type) unchanged
- Employee row badges simplified: Role + Client + Employee ID + Departments
  (no more raw designation text cluttering the row)
- Search placeholder updated: ''Search by name, role, or client...''
- Excel export: ''Designation / Project'' column renamed to
  ''Internal Tag (auto-generated)'' to set the right expectation

Downstream views updated to show Role+Client instead of raw designation:
- Observations employee dropdowns/filters
- Teams page member row subtitle (query updated to fetch employment_type, client)
- Org Chart PersonCard (dropped redundant role/designation line, kept
  Role + Client badges which already convey the same info)

KPI Entry form unchanged — Designation there is pre-filled from the employee''s
auto-generated tag but remains editable per-record, since that''s genuinely
useful for KPI tracking purposes. [commit 5c5ca87]', 'Done', 'Medium', 'system', '2026-06-30T06:02:13+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'remove manual Designation field, auto-generate from Role+Client; rename Employment Type to Role' and created_at = '2026-06-30T06:02:13+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Client support tagging on Employees (EMMA, AB BSS, Harlan + Holden)', 'Employees page:
- Add Client dropdown (EMMA, AB BSS, Harlan + Holden) to Add Employee form
  and both edit panels (single + multi-role)
- Color-coded badge shown inline on every employee row alongside Employment
  Type, Employee ID, and Department badges
- Client filter pills above the employee list (All / EMMA / AB BSS / Harlan + Holden)
- Set per-role: since multi-role support already works by giving each role its
  own employees row (same name, different designation/id), Client follows the
  exact same model — a person supporting multiple clients = multiple rows,
  same as multiple designations. This was already the existing pattern, so no
  new multi-role mechanism was needed.

Org Chart:
- Client badge now also shows on each person''s card (Team Lead + members)

Export to Excel:
- Added Employment Type, Client, and Department(s) columns to the export

SQL: employees-client-schema.sql adds client column, defaults existing
employees to ''AB BSS'' [commit f94bde9]', 'Done', 'Medium', 'system', '2026-06-30T05:42:44+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Client support tagging on Employees (EMMA, AB BSS, Harlan + Holden)' and created_at = '2026-06-30T05:42:44+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Employment Type field on Employees + Org Chart visualization', 'Employees page:
- Add Employment Type dropdown (Manager, Team Lead, Agent, Contractor, Intern,
  Probationary) to Add Employee form and both edit panels (single + multi-role)
- Color-coded badge shown inline on every employee row, alongside department
  badges and Employee ID
- Designation field unchanged — kept as the source info for Org Chart team roles
- Promoted EMPLOYMENT_TYPES/EMPLOYMENT_TYPE_COLORS to shared top-of-file constants

Org Chart (People > Org Chart):
- Fully built from existing Teams data (teams + team_members + team_lead_id)
- Grouped by department (from Teams), each department shows its teams as cards
- Each team card: Team Lead highlighted at top (dark blue), members listed below
  with a connecting line, like a simple hierarchy tree
- Each person shows name, designation, and employment type badge
- Search box highlights/dims people by name across the whole chart
- Empty state guides user to set up Teams first if none exist yet

SQL: employees-employment-type-schema.sql adds employment_type column,
defaults existing employees to ''Agent'' [commit b54c084]', 'Done', 'Medium', 'system', '2026-06-30T05:24:40+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Employment Type field on Employees + Org Chart visualization' and created_at = '2026-06-30T05:24:40+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'department tagging on Employees + real ticket routing to dept contacts', 'Employees page:
- Add multi-select department checkboxes (Operations, HR, Admin, IT, Payroll,
  Management, Logistics) to Add Employee form and both edit panels (single + multi-role)
- Department badges shown inline on every employee row, color-coded per department
- Promoted DEPARTMENTS/DEPT_BADGE_COLORS to shared top-of-file constants
  (previously duplicated separately inside the Tickets component)

Ticket routing:
- /api/notify/ticket-created now queries employees tagged with the ticket''s
  department and emails them directly (using their work email on file)
- Falls back to all managers/admins/team_leads if nobody is tagged for that
  department yet, so nothing falls through the cracks
- Email recipients are deduped (department contacts + manager safety net)
- Email body now shows a routing note: how many dept contacts got it, or
  whether it fell back to managers-only

SQL: employees-departments-schema.sql adds the departments text[] column + GIN index [commit 7642dad]', 'Done', 'Medium', 'system', '2026-06-30T05:08:41+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'department tagging on Employees + real ticket routing to dept contacts' and created_at = '2026-06-30T05:08:41+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'ticket department routing (Payroll, IT, Operations, Management, HR, Admin, Logistics)', '- Add department field to ticket submission form
- Department badge shown on every ticket card with distinct color per dept
- Filter tickets by department (alongside existing status filter)
- Email notification subject/body now leads with department routing
- Still notifies all super_admin/admin/team_lead (department is for triage/visibility,
  not a hard routing restriction, since there''s no department->user mapping yet)
- SQL: tickets-schema.sql updated with department column + check constraint
  Includes migration line for tables created before this update [commit 744a259]', 'Done', 'Medium', 'system', '2026-06-30T05:00:18+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'ticket department routing (Payroll, IT, Operations, Management, HR, Admin, Logistics)' and created_at = '2026-06-30T05:00:18+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Tickets page - submit, track, manage support requests', '- Agents/all users can submit tickets with title, description, category, priority
- Attach screenshots, PDFs, Word docs (uses existing ''attachments'' storage bucket)
- Status flow: Open -> In Progress -> Resolved -> Closed
- Status colored badges, priority colored badges (Urgent gets red border highlight)
- Filter by status (All/Open/In Progress/Resolved/Closed)
- My Tickets vs All Tickets toggle for managers/admins
- Click ticket to expand: full description, attachments, status controls
- Managers/Admin/TL can update status and delete tickets
- Email notification sent to all super_admin/admin/team_lead on new ticket submission
- New API route: /api/notify/ticket-created (reuses Gmail/nodemailer pattern)
- SQL: tickets-schema.sql creates the tickets table with RLS policies [commit bbcc9c7]', 'Done', 'Medium', 'system', '2026-06-30T04:52:32+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Tickets page - submit, track, manage support requests' and created_at = '2026-06-30T04:52:32+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Export employee records to Excel', '- Add Export to Excel button on Employee Management page
- Restricted to Admin and Team Lead roles (super_admin, admin, team_lead)
- Exports Employee ID, Name, Designation, Work Email, Status
- Auto-sorted by name, sensible column widths
- Filename includes export date: ABBSS_Employee_Records_YYYY-MM-DD.xlsx
- Uses xlsx package, dynamically imported to keep bundle size down [commit 208f677]', 'Done', 'Medium', 'system', '2026-06-30T04:46:19+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Export employee records to Excel' and created_at = '2026-06-30T04:46:19+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'frosted glass on all bg views, sidebar TL Tools, text readability', '- All non-performance views with background now wrapped in bg-white/88 backdrop-blur-md
  frosted glass panel — text always readable regardless of background
- KPI Entry, Observations, Operating Cadence moved to Team Lead Tools section
- Operations section now only has Tickets
- Gaming Hub background working correctly
- Performance dashboards and Org Chart stay clean (no glass, no bg) [commit 0c02e72]', 'Done', 'Medium', 'system', '2026-06-29T15:55:24+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'frosted glass on all bg views, sidebar TL Tools, text readability' and created_at = '2026-06-29T15:55:24+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'masterlist check when adding users + auto-employee creation', 'When adding a new user in Settings:
- Email is checked against the 31-person ABBSS masterlist in real-time
- GREEN banner: shows matched employee name + ID, confirms auto-link
- AMBER banner: not in masterlist, a new employee record will be created
- On save: checks if employee already exists in DB by email
  - If not found: auto-creates employee record with name, position, ID from masterlist
  - If masterlist match: assigns correct ABBSS-XXXXXX ID
  - If no match: creates record with email prefix as name (HR can update later)
- New employee immediately appears in People → Employees
- No breaking changes — purely additive [commit ac300f1]', 'Done', 'Medium', 'system', '2026-06-29T15:42:49+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'masterlist check when adding users + auto-employee creation' and created_at = '2026-06-29T15:42:49+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'gaming hub bg, sidebar reorder, HRIS records overhaul', 'Gaming Hub:
- Background image now shows on Gaming Hub (passes bgUrl from app)

Sidebar reorder (top to bottom):
- Home → Operations → Directory → HRIS → Team Lead Tools → Performance → People → System
- KPI Entry, Observations, Operating Cadence moved under Operations

Employee Records — full rebuild:
- Tab 1: Compliance Tracker — grid showing all active employees vs required docs
  (Resume, NBI, Medical, Psych Eval, SSS, PhilHealth, Pag-IBIG, TIN, Contract)
  Green ✓ / Red — per cell, status badge showing X/9 complete
  Summary stats: Total / Complete / Missing
- Tab 2: Upload Documents (HR/Admin only) — autocomplete employee name, all doc types
- Tab 3: My Documents — private uploads per user, visible ONLY to the uploader + HR/Admin
  is_private + owner_email fields enforce privacy
  All employees can upload their own docs, only they and HR can see them [commit 7861508]', 'Done', 'Medium', 'system', '2026-06-29T15:33:54+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'gaming hub bg, sidebar reorder, HRIS records overhaul' and created_at = '2026-06-29T15:33:54+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'HRIS section - Employee Referral + Employee Records', 'HRIS sidebar section with two modules:

Employee Referral:
- Anyone can submit a referral (candidate name, position, relationship, notes)
- Resume/CV upload (PDF, Word) stored in Supabase Storage
- HR/Admin can update status: Pending → Under Review → Interviewed → Hired/Declined
- Color-coded status badges
- Download link for uploaded resumes

Employee Records:
- HR/Admin can upload documents per employee (Resume, CV, NBI, Medical, etc.)
- Document types: Resume, CV, NBI Clearance, Medical Certificate, Psych Eval, SSS, PhilHealth, Pag-IBIG, TIN, Contract, Other
- Search by employee name or filename, filter by doc type
- Download button for all documents
- Only HR/Admin can upload or delete; Agents/TLs have view-only access
- File size display, uploaded by + date tracking

Background fix: blur(0px) brightness(0.60) to match announcement page sharpness [commit e076348]', 'Done', 'Medium', 'system', '2026-06-29T15:14:02+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'HRIS section - Employee Referral + Employee Records' and created_at = '2026-06-29T15:14:02+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'Google OAuth - proper PKCE flow, cookie-based session handoff', '- Rewrite /auth/callback with explicit PKCE flowType
- Handle OAuth errors from Google (error param in URL)
- Store access/refresh tokens in cookies after exchange
- initAuth reads cookies on load and sets Supabase session
- Clears cookies after use to avoid stale state
- Better error logging for debugging [commit eee5ffb]', 'Done', 'Medium', 'system', '2026-06-29T15:02:38+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Google OAuth - proper PKCE flow, cookie-based session handoff' and created_at = '2026-06-29T15:02:38+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'reduce background blur (blur 1px brightness 0.45), sharpen announcement bg', 'fix: reduce background blur (blur 1px brightness 0.45), sharpen announcement bg [commit 2504c14]', 'Done', 'Medium', 'system', '2026-06-29T14:40:59+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'reduce background blur (blur 1px brightness 0.45), sharpen announcement bg' and created_at = '2026-06-29T14:40:59+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'text readability over background + display name support', '- Gaming Hub: greeting and date text now white with drop-shadow
- Gaming Hub cards: frosted glass bg-white/95 backdrop-blur
- Non-performance bg views: darker overlay (brightness 0.30, blur 3px, bg-blue-950/55)
  so all existing text components are readable without color changes
- Gaming hub excluded from global overlay (manages its own background)
- Add displayName state - shows friendly name in header, sidebar, greeting
- displayName pulled from app_users.display_name via localStorage
- SQL needed: update app_users set display_name=''Dhave Latimer'' where email=''operations@ab-businesssupport.com'' [commit b7706f5]', 'Done', 'Medium', 'system', '2026-06-29T14:26:03+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'text readability over background + display name support' and created_at = '2026-06-29T14:26:03+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'remove personal email, global background theme, 56 employee IDs SQL', '- Remove personal_email from Employee type, state, DB insert/update, and all UI
- Add global background image to all non-performance, non-org-chart views
  (employees, teams, tickets, tl-tools, observations, settings, links, cadence, resources)
- Background uses the same image set in Announcements theme
- Performance views (dashboard-month/employee/team) and Org Chart stay clean
- Load bgUrl at app level so it''s available across all views
- Regenerate apply-employee-ids.sql with all 56 employees from updated record [commit 1577684]', 'Done', 'Medium', 'system', '2026-06-29T14:18:57+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'remove personal email, global background theme, 56 employee IDs SQL' and created_at = '2026-06-29T14:18:57+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'Employee type includes employee_id + personal_email, proper display', '- Add employee_id and personal_email to Employee TypeScript type
- Remove all ''as any'' casts - now properly typed
- Employee ID shows as a blue monospace badge next to designation
- Badge shows for both single-role and multi-role employees
- Edit panel pre-fills correctly from typed fields [commit b91cf70]', 'Done', 'Medium', 'system', '2026-06-29T14:00:44+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Employee type includes employee_id + personal_email, proper display' and created_at = '2026-06-29T14:00:44+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'sidebar coaching badge, agent filtering, prominent pending notification', 'Sidebar:
- Red badge on ''Coaching & 1-on-1'' nav item showing pending count
- Viewers see count of sessions they need to acknowledge
- TLs/Admins see total pending across all agents
- Badge updates immediately after agent acknowledges

Agent filtering (viewers):
- Only see coaching sessions where employee_email = their login email
- Cannot see other team members'' coaching records

Pending notification:
- ViewerCoachingBanner: dynamic amber alert at top of TL Tools
- Lists each pending session (type, date, coached by)
- Shows green ''All caught up'' when nothing pending
- Points agents to the table below to sign off
- Static info message replaced with live DB query [commit 71baf3a]', 'Done', 'Medium', 'system', '2026-06-29T13:57:01+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'sidebar coaching badge, agent filtering, prominent pending notification' and created_at = '2026-06-29T13:57:01+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'employee edit panel - no more overlapping fields', '- Replace inline cramped edit inputs with a clean expandable panel
- Edit panel opens below the employee row (like a drawer) when pencil clicked
- Click pencil again to close, or click Cancel/Save
- Labeled fields in a proper grid: Employee ID, Name, Designation, Work Email, Personal Email
- Same clean layout for both single-role and multi-role employees
- Add apply-employee-ids.sql to auto-populate all 22 employee IDs from the record export [commit befb81d]', 'Done', 'Medium', 'system', '2026-06-29T13:44:53+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'employee edit panel - no more overlapping fields' and created_at = '2026-06-29T13:44:53+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'employee IDs, personal email, coaching e-signature acknowledgment', 'Employee Manager:
- Add Employee ID field (ABBSS-XXXXXX format) to add + edit forms
- Add Personal Email field (for coaching notifications)
- Employee ID shown in list alongside designation
- Both fields persist to Supabase

Coaching Log:
- Add ''Send for agent e-signature/acknowledgment'' checkbox
- Agents see pending acknowledgments banner + Sign button
- Once signed, shows green ''Acknowledged'' badge with timestamp
- TL/Admin sees pending/acknowledged status per session
- requires_acknowledgment + agent_acknowledged fields in DB

SQL: employee-coaching-schema.sql with all migration steps [commit fe2ea77]', 'Done', 'Medium', 'system', '2026-06-29T13:37:50+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'employee IDs, personal email, coaching e-signature acknowledgment' and created_at = '2026-06-29T13:37:50+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'announcement panel fills full screen width and height', '- Remove max-width/padding wrapper for announcements view
- Announcements render full-bleed (no side gutters, no greeting header eating space)
- Gaming Hub keeps its own padded layout with greeting
- AnnouncementsPanel height is 100% of its flex container
- Other views (dashboard, employees, etc) keep their padded max-width layout [commit c5cff84]', 'Done', 'Medium', 'system', '2026-06-29T13:19:48+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'announcement panel fills full screen width and height' and created_at = '2026-06-29T13:19:48+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'announcement overhaul - full height, grouped by month, read more/less', '- Announcement panel fills exact screen height (no gap at bottom)
- Background image covers full panel edge-to-edge
- Announcements grouped by month with collapsible sections
- Current month expanded by default, older months collapsed
- Read More / Read Less toggle on long announcements (>180 chars)
- Theme button styled to match background (glass look when bg is set)
- Post form uses frosted glass style when background is active [commit 99f31ec]', 'Done', 'Medium', 'system', '2026-06-29T13:15:15+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'announcement overhaul - full height, grouped by month, read more/less' and created_at = '2026-06-29T13:15:15+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'coaching log improvements + sidebar/announcement layout fixes', '- Add ''Initiated By'' field to coaching log (Team Lead / Agent / Manager / HR)
- Remove 1-on-1 Tracker tab, replace with TL Compliance Report
- Compliance report: monthly summary (sessions per TL, compliant/below target)
- Compliance report: weekly breakdown (sessions per TL per week)
- Fix announcement background to fill full screen height
- Fix sidebar: stays fixed, only main content scrolls
- Fix root layout to h-screen overflow-hidden [commit 759a9e7]', 'Done', 'Medium', 'system', '2026-06-29T13:06:17+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'coaching log improvements + sidebar/announcement layout fixes' and created_at = '2026-06-29T13:06:17+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Google OAuth callback route + TL Tools (Coaching Log & 1-on-1 Tracker)', '- Add /auth/callback route for Supabase OAuth code exchange
- Fix redirectTo in handleGoogleLogin to use /auth/callback
- Add domain-restriction error handling with URL params
- Build CoachingLog component (log sessions, filter by employee/month, type badges, overdue next-session alerts)
- Build OneOnOneTracker component (mood rating, overdue detection, coverage stats)
- Agents (viewer role) see only their own records
- TL/Admin/Super Admin see all records
- Add tl-tools-schema.sql for coaching_logs + one_on_one_logs tables
- Add .gitignore [commit 18260c2]', 'Done', 'Medium', 'system', '2026-06-29T12:54:57+00:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Google OAuth callback route + TL Tools (Coaching Log & 1-on-1 Tracker)' and created_at = '2026-06-29T12:54:57+00:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Accept both company domains for Google login', 'Accept both company domains for Google login [commit 49ce46f]', 'Done', 'Medium', 'system', '2026-06-29T13:49:50+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Accept both company domains for Google login' and created_at = '2026-06-29T13:49:50+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Handle Google OAuth session + domain restriction + role lookup', 'Handle Google OAuth session + domain restriction + role lookup [commit 5b1a675]', 'Done', 'Medium', 'system', '2026-06-29T13:37:12+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Handle Google OAuth session + domain restriction + role lookup' and created_at = '2026-06-29T13:37:12+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add Sign in with Google button (domain-restricted)', 'Add Sign in with Google button (domain-restricted) [commit 64e32e0]', 'Done', 'Medium', 'system', '2026-06-29T13:36:45+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add Sign in with Google button (domain-restricted)' and created_at = '2026-06-29T13:36:45+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Make Links editable for managers and team leads', 'Make Links editable for managers and team leads [commit 423934c]', 'Done', 'Medium', 'system', '2026-06-29T13:28:57+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Make Links editable for managers and team leads' and created_at = '2026-06-29T13:28:57+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add Operating Cadence + split Directory into Links and Resources', 'Add Operating Cadence + split Directory into Links and Resources [commit 6ff3df8]', 'Done', 'Medium', 'system', '2026-06-29T13:21:24+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add Operating Cadence + split Directory into Links and Resources' and created_at = '2026-06-29T13:21:24+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add Laptop Issuance Form to resources', 'Add Laptop Issuance Form to resources [commit 54301ec]', 'Done', 'Medium', 'system', '2026-06-29T13:20:06+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add Laptop Issuance Form to resources' and created_at = '2026-06-29T13:20:06+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Sharpen announcement bg - reduce blur, lighten overlay', 'Sharpen announcement bg - reduce blur, lighten overlay [commit 12f36e0]', 'Done', 'Medium', 'system', '2026-06-29T13:09:59+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Sharpen announcement bg - reduce blur, lighten overlay' and created_at = '2026-06-29T13:09:59+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Make announcement bg cover entire page', 'Make announcement bg cover entire page [commit 8babad6]', 'Done', 'Medium', 'system', '2026-06-29T13:06:24+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Make announcement bg cover entire page' and created_at = '2026-06-29T13:06:24+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix CSP: allow images from Supabase storage and https', 'Fix CSP: allow images from Supabase storage and https [commit e21d351]', 'Done', 'Medium', 'system', '2026-06-29T13:03:07+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix CSP: allow images from Supabase storage and https' and created_at = '2026-06-29T13:03:07+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add bg image error handler + solid fallback color', 'Add bg image error handler + solid fallback color [commit 58ceff1]', 'Done', 'Medium', 'system', '2026-06-29T13:00:06+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add bg image error handler + solid fallback color' and created_at = '2026-06-29T13:00:06+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Remove unused bgInput state references', 'Remove unused bgInput state references [commit 39974b9]', 'Done', 'Medium', 'system', '2026-06-29T12:57:26+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Remove unused bgInput state references' and created_at = '2026-06-29T12:57:26+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Simplify theme bg: upload only, remove URL paste', 'Simplify theme bg: upload only, remove URL paste [commit a7b0496]', 'Done', 'Medium', 'system', '2026-06-29T12:57:11+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Simplify theme bg: upload only, remove URL paste' and created_at = '2026-06-29T12:57:11+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add file upload for theme bg + helper text for URLs', 'Add file upload for theme bg + helper text for URLs [commit 22bcdd0]', 'Done', 'Medium', 'system', '2026-06-29T12:54:33+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add file upload for theme bg + helper text for URLs' and created_at = '2026-06-29T12:54:33+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix flicker: move theme button to header, remove dashed box', 'Fix flicker: move theme button to header, remove dashed box [commit 368ae19]', 'Done', 'Medium', 'system', '2026-06-29T12:46:04+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix flicker: move theme button to header, remove dashed box' and created_at = '2026-06-29T12:46:04+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix bg flicker: use undefined as unloaded state', 'Fix bg flicker: use undefined as unloaded state [commit 3174282]', 'Done', 'Medium', 'system', '2026-06-29T12:43:53+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix bg flicker: use undefined as unloaded state' and created_at = '2026-06-29T12:43:53+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Clean build: remove cache bust comment, verify no stale references', 'Clean build: remove cache bust comment, verify no stale references [commit ae226bc]', 'Done', 'Medium', 'system', '2026-06-29T12:41:52+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Clean build: remove cache bust comment, verify no stale references' and created_at = '2026-06-29T12:41:52+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Force cache bust - clear stale Vercel build cache', 'Force cache bust - clear stale Vercel build cache [commit fa7da77]', 'Done', 'Medium', 'system', '2026-06-28T19:44:19+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Force cache bust - clear stale Vercel build cache' and created_at = '2026-06-28T19:44:19+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'use simple .then() for bg load, remove .finally()', 'Fix: use simple .then() for bg load, remove .finally() [commit 7f8251a]', 'Done', 'Medium', 'system', '2026-06-28T19:43:17+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'use simple .then() for bg load, remove .finally()' and created_at = '2026-06-28T19:43:17+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Remove all bgLoaded references causing build errors', 'Remove all bgLoaded references causing build errors [commit d9af288]', 'Done', 'Medium', 'system', '2026-06-28T19:42:22+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Remove all bgLoaded references causing build errors' and created_at = '2026-06-28T19:42:22+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix setBgLoaded placement with async loadBg function', 'Fix setBgLoaded placement with async loadBg function [commit f7fcaed]', 'Done', 'Medium', 'system', '2026-06-28T19:41:13+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix setBgLoaded placement with async loadBg function' and created_at = '2026-06-28T19:41:13+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'remove invalid .catch() on Supabase PromiseLike', 'Fix: remove invalid .catch() on Supabase PromiseLike [commit 13f35b4]', 'Done', 'Medium', 'system', '2026-06-28T19:40:01+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'remove invalid .catch() on Supabase PromiseLike' and created_at = '2026-06-28T19:40:01+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix bg flicker with load state, hide from agents', 'Fix bg flicker with load state, hide from agents [commit f0d4f8c]', 'Done', 'Medium', 'system', '2026-06-28T19:38:48+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix bg flicker with load state, hide from agents' and created_at = '2026-06-28T19:38:48+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add URL-based announcement background with banner display', 'Add URL-based announcement background with banner display [commit 4af5edc]', 'Done', 'Medium', 'system', '2026-06-28T19:35:46+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add URL-based announcement background with banner display' and created_at = '2026-06-28T19:35:46+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'remove remaining bgUrl references', 'Fix: remove remaining bgUrl references [commit 1079124]', 'Done', 'Medium', 'system', '2026-06-28T19:32:24+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'remove remaining bgUrl references' and created_at = '2026-06-28T19:32:24+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'remove extra closing div in AnnouncementsPanel', 'Fix: remove extra closing div in AnnouncementsPanel [commit 579bd16]', 'Done', 'Medium', 'system', '2026-06-28T19:31:16+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'remove extra closing div in AnnouncementsPanel' and created_at = '2026-06-28T19:31:16+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'replace box-drawing unicode chars in comments', 'Fix: replace box-drawing unicode chars in comments [commit 6701b1b]', 'Done', 'Medium', 'system', '2026-06-28T19:30:06+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'replace box-drawing unicode chars in comments' and created_at = '2026-06-28T19:30:06+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Remove all special unicode chars from AnnouncementsPanel', 'Remove all special unicode chars from AnnouncementsPanel [commit ba9853f]', 'Done', 'Medium', 'system', '2026-06-28T19:28:44+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Remove all special unicode chars from AnnouncementsPanel' and created_at = '2026-06-28T19:28:44+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'replace middle dot character causing regexp parse error', 'Fix: replace middle dot character causing regexp parse error [commit def09b6]', 'Done', 'Medium', 'system', '2026-06-28T19:27:34+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'replace middle dot character causing regexp parse error' and created_at = '2026-06-28T19:27:34+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Remove bg image feature temporarily to fix build', 'Remove bg image feature temporarily to fix build [commit ee5d2b1]', 'Done', 'Medium', 'system', '2026-06-28T19:26:05+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Remove bg image feature temporarily to fix build' and created_at = '2026-06-28T19:26:05+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'move bgStyle to variable to avoid JSX parser issues', 'Fix: move bgStyle to variable to avoid JSX parser issues [commit bcd5de0]', 'Done', 'Medium', 'system', '2026-06-28T19:24:10+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'move bgStyle to variable to avoid JSX parser issues' and created_at = '2026-06-28T19:24:10+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'show bg as top banner, fix text colors, simplify layout', 'Fix: show bg as top banner, fix text colors, simplify layout [commit f58958b]', 'Done', 'Medium', 'system', '2026-06-28T19:22:11+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'show bg as top banner, fix text colors, simplify layout' and created_at = '2026-06-28T19:22:11+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix text colors in announcements panel', 'Fix text colors in announcements panel [commit e7c7ca2]', 'Done', 'Medium', 'system', '2026-06-28T19:19:46+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix text colors in announcements panel' and created_at = '2026-06-28T19:19:46+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'close missing inner div in AnnouncementsPanel', 'Fix: close missing inner div in AnnouncementsPanel [commit b216541]', 'Done', 'Medium', 'system', '2026-06-28T19:16:46+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'close missing inner div in AnnouncementsPanel' and created_at = '2026-06-28T19:16:46+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix JSX ternary formatting in AnnouncementsPanel', 'Fix JSX ternary formatting in AnnouncementsPanel [commit 95c7daf]', 'Done', 'Medium', 'system', '2026-06-28T19:15:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix JSX ternary formatting in AnnouncementsPanel' and created_at = '2026-06-28T19:15:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix JSX ternary syntax in AnnouncementsPanel', 'Fix JSX ternary syntax in AnnouncementsPanel [commit f35557c]', 'Done', 'Medium', 'system', '2026-06-28T19:09:07+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix JSX ternary syntax in AnnouncementsPanel' and created_at = '2026-06-28T19:09:07+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'properly place ThemeBg+Announcements before GameOfMonth', 'Fix: properly place ThemeBg+Announcements before GameOfMonth [commit 32d0bb2]', 'Done', 'Medium', 'system', '2026-06-28T19:06:33+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'properly place ThemeBg+Announcements before GameOfMonth' and created_at = '2026-06-28T19:06:33+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix component order: move ThemeBg+Announcements before HomeScreen', 'Fix component order: move ThemeBg+Announcements before HomeScreen [commit 1480ea9]', 'Done', 'Medium', 'system', '2026-06-28T19:06:12+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix component order: move ThemeBg+Announcements before HomeScreen' and created_at = '2026-06-28T19:06:12+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix JSX apostrophe syntax errors', 'Fix JSX apostrophe syntax errors [commit 476f670]', 'Done', 'Medium', 'system', '2026-06-28T19:05:27+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix JSX apostrophe syntax errors' and created_at = '2026-06-28T19:05:27+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix JSX template literal in background style', 'Fix JSX template literal in background style [commit 84bff26]', 'Done', 'Medium', 'system', '2026-06-28T19:04:07+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix JSX template literal in background style' and created_at = '2026-06-28T19:04:07+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add monthly theme background uploader to announcements', 'Add monthly theme background uploader to announcements [commit 86ad9b0]', 'Done', 'Medium', 'system', '2026-06-28T19:00:03+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add monthly theme background uploader to announcements' and created_at = '2026-06-28T19:00:03+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Re-add missing AnnouncementsPanel component', 'Re-add missing AnnouncementsPanel component [commit 50c6190]', 'Done', 'Medium', 'system', '2026-06-28T18:53:28+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Re-add missing AnnouncementsPanel component' and created_at = '2026-06-28T18:53:28+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Remove Anthropic dependency from extract-score route', 'Remove Anthropic dependency from extract-score route [commit dfb95a5]', 'Done', 'Medium', 'system', '2026-06-28T18:51:23+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Remove Anthropic dependency from extract-score route' and created_at = '2026-06-28T18:51:23+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Show score timestamp on leaderboard', 'Show score timestamp on leaderboard [commit 53b34c7]', 'Done', 'Medium', 'system', '2026-06-28T18:49:24+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Show score timestamp on leaderboard' and created_at = '2026-06-28T18:49:24+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Free version: screenshot upload + manual admin score approval', 'Free version: screenshot upload + manual admin score approval [commit ad5358a]', 'Done', 'Medium', 'system', '2026-06-28T18:46:20+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Free version: screenshot upload + manual admin score approval' and created_at = '2026-06-28T18:46:20+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Rich announcements (images/PDF/doc) + screenshot score submission with Claude vision', 'Rich announcements (images/PDF/doc) + screenshot score submission with Claude vision [commit 622eb16]', 'Done', 'Medium', 'system', '2026-06-28T18:37:15+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Rich announcements (images/PDF/doc) + screenshot score submission with Claude vision' and created_at = '2026-06-28T18:37:15+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add Claude vision score extractor API', 'Add Claude vision score extractor API [commit 2b8ffda]', 'Done', 'Medium', 'system', '2026-06-28T18:34:12+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add Claude vision score extractor API' and created_at = '2026-06-28T18:34:12+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Replace canvas game with Game of Month card + score submission', 'Replace canvas game with Game of Month card + score submission [commit 76ecd5a]', 'Done', 'Medium', 'system', '2026-06-28T18:24:44+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Replace canvas game with Game of Month card + score submission' and created_at = '2026-06-28T18:24:44+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Rewrite BrickBreaker with strict TypeScript safety', 'Rewrite BrickBreaker with strict TypeScript safety [commit 0be445d]', 'Done', 'Medium', 'system', '2026-06-28T18:22:19+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Rewrite BrickBreaker with strict TypeScript safety' and created_at = '2026-06-28T18:22:19+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'assert canvas ctx type as CanvasRenderingContext2D', 'Fix: assert canvas ctx type as CanvasRenderingContext2D [commit af2e017]', 'Done', 'Medium', 'system', '2026-06-28T18:20:43+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'assert canvas ctx type as CanvasRenderingContext2D' and created_at = '2026-06-28T18:20:43+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix TypeScript: canvas null check, event listener types', 'Fix TypeScript: canvas null check, event listener types [commit b9f6517]', 'Done', 'Medium', 'system', '2026-06-28T18:19:31+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix TypeScript: canvas null check, event listener types' and created_at = '2026-06-28T18:19:31+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'add Bell and Gamepad2 to lucide imports', 'Fix: add Bell and Gamepad2 to lucide imports [commit 6908a41]', 'Done', 'Medium', 'system', '2026-06-28T18:17:01+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'add Bell and Gamepad2 to lucide imports' and created_at = '2026-06-28T18:17:01+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'remove duplicate imports and supabase client mid-file', 'Fix: remove duplicate imports and supabase client mid-file [commit 91ee724]', 'Done', 'Medium', 'system', '2026-06-28T18:15:55+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'remove duplicate imports and supabase client mid-file' and created_at = '2026-06-28T18:15:55+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix build errors: add useRef/useCallback imports, remove roundRect', 'Fix build errors: add useRef/useCallback imports, remove roundRect [commit 423f54b]', 'Done', 'Medium', 'system', '2026-06-28T18:14:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix build errors: add useRef/useCallback imports, remove roundRect' and created_at = '2026-06-28T18:14:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add announcements and gaming-hub to View type', 'Add announcements and gaming-hub to View type [commit f14e3f6]', 'Done', 'Medium', 'system', '2026-06-28T18:10:41+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add announcements and gaming-hub to View type' and created_at = '2026-06-28T18:10:41+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Set default view to announcements', 'Set default view to announcements [commit 8c89ca8]', 'Done', 'Medium', 'system', '2026-06-28T18:07:34+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Set default view to announcements' and created_at = '2026-06-28T18:07:34+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'add home to collapsed state so HOME section shows expanded', 'Fix: add home to collapsed state so HOME section shows expanded [commit 0fb9e8e]', 'Done', 'Medium', 'system', '2026-06-28T18:07:04+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'add home to collapsed state so HOME section shows expanded' and created_at = '2026-06-28T18:07:04+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix Home nav: proper section with Announcements + Gaming Hub subitems', 'Fix Home nav: proper section with Announcements + Gaming Hub subitems [commit 8117821]', 'Done', 'Medium', 'system', '2026-06-28T18:02:02+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix Home nav: proper section with Announcements + Gaming Hub subitems' and created_at = '2026-06-28T18:02:02+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add Home screen: Announcements + Brick Breaker game + leaderboard', 'Add Home screen: Announcements + Brick Breaker game + leaderboard [commit 58fb79d]', 'Done', 'Medium', 'system', '2026-06-28T17:57:18+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add Home screen: Announcements + Brick Breaker game + leaderboard' and created_at = '2026-06-28T17:57:18+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Revert login card to clean white', 'Revert login card to clean white [commit bf836cd]', 'Done', 'Medium', 'system', '2026-06-28T14:13:23+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Revert login card to clean white' and created_at = '2026-06-28T14:13:23+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Force rebuild: Operations Portal title v2', 'Force rebuild: Operations Portal title v2 [commit 778cba5]', 'Done', 'Medium', 'system', '2026-06-28T14:08:30+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Force rebuild: Operations Portal title v2' and created_at = '2026-06-28T14:08:30+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'FINAL: Change login h1 to Operations Portal only', 'FINAL: Change login h1 to Operations Portal only [commit 417fcda]', 'Done', 'Medium', 'system', '2026-06-28T07:40:03+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'FINAL: Change login h1 to Operations Portal only' and created_at = '2026-06-28T07:40:03+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix login title to Operations Portal', 'Fix login title to Operations Portal [commit 28518af]', 'Done', 'Medium', 'system', '2026-06-28T07:37:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix login title to Operations Portal' and created_at = '2026-06-28T07:37:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Frosted glass login card + Operations Portal title fix', 'Frosted glass login card + Operations Portal title fix [commit 0c91cc9]', 'Done', 'Medium', 'system', '2026-06-28T07:34:25+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Frosted glass login card + Operations Portal title fix' and created_at = '2026-06-28T07:34:25+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Change login screen title to Operations Portal', 'Change login screen title to Operations Portal [commit 93e0747]', 'Done', 'Medium', 'system', '2026-06-28T07:32:25+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Change login screen title to Operations Portal' and created_at = '2026-06-28T07:32:25+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Rename to ABBSS Operations Portal + mobile responsive login', 'Rename to ABBSS Operations Portal + mobile responsive login [commit f4305c7]', 'Done', 'Medium', 'system', '2026-06-28T07:21:46+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Rename to ABBSS Operations Portal + mobile responsive login' and created_at = '2026-06-28T07:21:46+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add PWA manifest for mobile home screen install', 'Add PWA manifest for mobile home screen install [commit 2125202]', 'Done', 'Medium', 'system', '2026-06-28T07:21:30+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add PWA manifest for mobile home screen install' and created_at = '2026-06-28T07:21:30+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Rename to ABBSS Operations Portal + mobile viewport meta', 'Rename to ABBSS Operations Portal + mobile viewport meta [commit 03b5eba]', 'Done', 'Medium', 'system', '2026-06-28T07:21:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Rename to ABBSS Operations Portal + mobile viewport meta' and created_at = '2026-06-28T07:21:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix login bg: use JPG, shift card to right, show more photo', 'Fix login bg: use JPG, shift card to right, show more photo [commit 53a69ff]', 'Done', 'Medium', 'system', '2026-06-28T07:17:34+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix login bg: use JPG, shift card to right, show more photo' and created_at = '2026-06-28T07:17:34+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add login background as JPG for compatibility', 'Add login background as JPG for compatibility [commit 3e8e6b2]', 'Done', 'Medium', 'system', '2026-06-28T07:17:21+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add login background as JPG for compatibility' and created_at = '2026-06-28T07:17:21+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix login: support email or username, proper fallback chain', 'Fix login: support email or username, proper fallback chain [commit a9d4d1d]', 'Done', 'Medium', 'system', '2026-06-28T07:13:28+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix login: support email or username, proper fallback chain' and created_at = '2026-06-28T07:13:28+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update login screen with remote-work background image', 'Update login screen with remote-work background image [commit f1f4719]', 'Done', 'Medium', 'system', '2026-06-28T07:08:48+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update login screen with remote-work background image' and created_at = '2026-06-28T07:08:48+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add login background image', 'Add login background image [commit 02bea20]', 'Done', 'Medium', 'system', '2026-06-28T07:08:34+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add login background image' and created_at = '2026-06-28T07:08:34+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Use Resend free sender until domain verified', 'Use Resend free sender until domain verified [commit 1546e46]', 'Done', 'Medium', 'system', '2026-06-28T07:01:40+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Use Resend free sender until domain verified' and created_at = '2026-06-28T07:01:40+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add forgot password + email reset flow to login screen', 'Add forgot password + email reset flow to login screen [commit 56177e9]', 'Done', 'Medium', 'system', '2026-06-28T06:53:54+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add forgot password + email reset flow to login screen' and created_at = '2026-06-28T06:53:54+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add reset-password token validation route', 'Add reset-password token validation route [commit 7f5feee]', 'Done', 'Medium', 'system', '2026-06-28T06:51:18+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add reset-password token validation route' and created_at = '2026-06-28T06:51:18+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add forgot-password API route with Resend email', 'Add forgot-password API route with Resend email [commit 154d095]', 'Done', 'Medium', 'system', '2026-06-28T06:51:18+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add forgot-password API route with Resend email' and created_at = '2026-06-28T06:51:18+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add email to employee edit + auto-create app_user login on email save', 'Add email to employee edit + auto-create app_user login on email save [commit 5861b81]', 'Done', 'Medium', 'system', '2026-06-28T06:43:44+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add email to employee edit + auto-create app_user login on email save' and created_at = '2026-06-28T06:43:44+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Restrict Settings tabs by role - agents see only My Profile', 'Restrict Settings tabs by role - agents see only My Profile [commit 4e5696e]', 'Done', 'Medium', 'system', '2026-06-28T06:30:17+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Restrict Settings tabs by role - agents see only My Profile' and created_at = '2026-06-28T06:30:17+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Switch to Gmail SMTP via nodemailer', 'Switch to Gmail SMTP via nodemailer [commit 239e73f]', 'Done', 'Medium', 'system', '2026-06-28T06:19:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Switch to Gmail SMTP via nodemailer' and created_at = '2026-06-28T06:19:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add nodemailer', 'Add nodemailer [commit bb465c8]', 'Done', 'Medium', 'system', '2026-06-28T06:19:28+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add nodemailer' and created_at = '2026-06-28T06:19:28+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix TypeScript error - use currentUser in SettingsPanel', 'Fix TypeScript error - use currentUser in SettingsPanel [commit ebc8153]', 'Done', 'Medium', 'system', '2026-06-28T06:06:38+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix TypeScript error - use currentUser in SettingsPanel' and created_at = '2026-06-28T06:06:38+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Trigger email notification when new user is added', 'Trigger email notification when new user is added [commit b32a6a2]', 'Done', 'Medium', 'system', '2026-06-28T06:01:24+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Trigger email notification when new user is added' and created_at = '2026-06-28T06:01:24+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add email notification for new user creation', 'Add email notification for new user creation [commit 62ac3c5]', 'Done', 'Medium', 'system', '2026-06-28T06:01:08+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add email notification for new user creation' and created_at = '2026-06-28T06:01:08+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add resend for email notifications', 'Add resend for email notifications [commit 1eb1a2d]', 'Done', 'Medium', 'system', '2026-06-28T06:01:07+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add resend for email notifications' and created_at = '2026-06-28T06:01:07+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add email field to employee records for viewer access control', 'Add email field to employee records for viewer access control [commit 58c645d]', 'Done', 'Medium', 'system', '2026-06-28T05:49:06+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add email field to employee records for viewer access control' and created_at = '2026-06-28T05:49:06+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add email to Employee type', 'Add email to Employee type [commit 28ac096]', 'Done', 'Medium', 'system', '2026-06-28T05:49:05+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add email to Employee type' and created_at = '2026-06-28T05:49:05+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Link users to employees + admin preview as viewer mode', 'Link users to employees + admin preview as viewer mode [commit db8cb7b]', 'Done', 'Medium', 'system', '2026-06-28T05:45:59+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Link users to employees + admin preview as viewer mode' and created_at = '2026-06-28T05:45:59+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Viewer role: show only own team, hide notes and edit', 'Viewer role: show only own team, hide notes and edit [commit 6686d59]', 'Done', 'Medium', 'system', '2026-06-28T05:39:44+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Viewer role: show only own team, hide notes and edit' and created_at = '2026-06-28T05:39:44+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix double curly brace syntax error', 'Fix double curly brace syntax error [commit 873eda2]', 'Done', 'Medium', 'system', '2026-06-28T05:35:43+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix double curly brace syntax error' and created_at = '2026-06-28T05:35:43+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix broken aside and directory render', 'Fix broken aside and directory render [commit 598f14e]', 'Done', 'Medium', 'system', '2026-06-28T05:34:32+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix broken aside and directory render' and created_at = '2026-06-28T05:34:32+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Wire collapsible sidebar + add ClockSmart to Directory', 'Wire collapsible sidebar + add ClockSmart to Directory [commit c996057]', 'Done', 'Medium', 'system', '2026-06-28T05:29:47+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Wire collapsible sidebar + add ClockSmart to Directory' and created_at = '2026-06-28T05:29:47+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix collapsible sidebar - proper state management', 'Fix collapsible sidebar - proper state management [commit b84dc1d]', 'Done', 'Medium', 'system', '2026-06-28T05:24:19+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix collapsible sidebar - proper state management' and created_at = '2026-06-28T05:24:19+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Collapsible sidebar sections with chevron toggle', 'Collapsible sidebar sections with chevron toggle [commit 6696969]', 'Done', 'Medium', 'system', '2026-06-28T05:21:57+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Collapsible sidebar sections with chevron toggle' and created_at = '2026-06-28T05:21:57+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Bold navy pill section labels in sidebar', 'Bold navy pill section labels in sidebar [commit 8747c8b]', 'Done', 'Medium', 'system', '2026-06-28T05:20:01+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Bold navy pill section labels in sidebar' and created_at = '2026-06-28T05:20:01+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', '3D bezel sidebar, gradient header, colored card borders, hover effects', '3D bezel sidebar, gradient header, colored card borders, hover effects [commit a629e5d]', 'Done', 'Medium', 'system', '2026-06-28T05:15:47+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = '3D bezel sidebar, gradient header, colored card borders, hover effects' and created_at = '2026-06-28T05:15:47+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Move KPI Entry and Observations under Team Lead Tools', 'Move KPI Entry and Observations under Team Lead Tools [commit 9e54b70]', 'Done', 'Medium', 'system', '2026-06-28T03:38:18+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Move KPI Entry and Observations under Team Lead Tools' and created_at = '2026-06-28T03:38:18+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'White sidebar with black text and bold active highlights', 'White sidebar with black text and bold active highlights [commit 8e45af5]', 'Done', 'Medium', 'system', '2026-06-28T03:36:50+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'White sidebar with black text and bold active highlights' and created_at = '2026-06-28T03:36:50+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Full sidebar nav with sections: Performance, People, Operations, TL Tools, Directory', 'Full sidebar nav with sections: Performance, People, Operations, TL Tools, Directory [commit bbacb55]', 'Done', 'Medium', 'system', '2026-06-28T03:33:27+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Full sidebar nav with sections: Performance, People, Operations, TL Tools, Directory' and created_at = '2026-06-28T03:33:27+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix navy theme using Tailwind built-in colors', 'Fix navy theme using Tailwind built-in colors [commit 9c903c0]', 'Done', 'Medium', 'system', '2026-06-28T03:26:55+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix navy theme using Tailwind built-in colors' and created_at = '2026-06-28T03:26:55+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Deep navy professional theme', 'Deep navy professional theme [commit d5dcae8]', 'Done', 'Medium', 'system', '2026-06-28T03:26:02+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Deep navy professional theme' and created_at = '2026-06-28T03:26:02+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Store email on user creation, validate domain', 'Store email on user creation, validate domain [commit 736f2d2]', 'Done', 'Medium', 'system', '2026-06-28T03:20:58+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Store email on user creation, validate domain' and created_at = '2026-06-28T03:20:58+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Email-based login with domain validation', 'Email-based login with domain validation [commit a5c40f8]', 'Done', 'Medium', 'system', '2026-06-28T03:20:57+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Email-based login with domain validation' and created_at = '2026-06-28T03:20:57+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update login UI to use email field', 'Update login UI to use email field [commit b4f9023]', 'Done', 'Medium', 'system', '2026-06-28T03:20:56+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update login UI to use email field' and created_at = '2026-06-28T03:20:56+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Role-based access: super_admin, admin/manager, team_lead, viewer', 'Role-based access: super_admin, admin/manager, team_lead, viewer [commit 5d9fab4]', 'Done', 'Medium', 'system', '2026-06-28T03:17:43+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Role-based access: super_admin, admin/manager, team_lead, viewer' and created_at = '2026-06-28T03:17:43+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Use service role key for password change', 'Use service role key for password change [commit c0d5568]', 'Done', 'Medium', 'system', '2026-06-28T03:09:51+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Use service role key for password change' and created_at = '2026-06-28T03:09:51+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Use service role key for login', 'Use service role key for login [commit c7fcf96]', 'Done', 'Medium', 'system', '2026-06-28T03:09:50+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Use service role key for login' and created_at = '2026-06-28T03:09:50+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Use service role key for user management', 'Use service role key for user management [commit aff7c05]', 'Done', 'Medium', 'system', '2026-06-28T03:09:49+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Use service role key for user management' and created_at = '2026-06-28T03:09:49+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add profile pictures, colored avatars, UserAvatar component', 'Add profile pictures, colored avatars, UserAvatar component [commit c4de187]', 'Done', 'Medium', 'system', '2026-06-28T02:58:21+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add profile pictures, colored avatars, UserAvatar component' and created_at = '2026-06-28T02:58:21+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Simplify observations - remove general log, add month filter, show encoder', 'Simplify observations - remove general log, add month filter, show encoder [commit 380e54e]', 'Done', 'Medium', 'system', '2026-06-28T02:52:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Simplify observations - remove general log, add month filter, show encoder' and created_at = '2026-06-28T02:52:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add observations panel + fix team filter dropdown', 'Add observations panel + fix team filter dropdown [commit 84ba694]', 'Done', 'Medium', 'system', '2026-06-28T02:45:24+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add observations panel + fix team filter dropdown' and created_at = '2026-06-28T02:45:24+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix TypeScript error in bar chart tooltip', 'Fix TypeScript error in bar chart tooltip [commit ee05d9c]', 'Done', 'Medium', 'system', '2026-06-28T02:38:08+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix TypeScript error in bar chart tooltip' and created_at = '2026-06-28T02:38:08+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add bar chart and team filter to Performance page', 'Add bar chart and team filter to Performance page [commit e1badd2]', 'Done', 'Medium', 'system', '2026-06-28T02:35:32+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add bar chart and team filter to Performance page' and created_at = '2026-06-28T02:35:32+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Black search text, fix chart threshold and domain', 'Black search text, fix chart threshold and domain [commit eee2613]', 'Done', 'Medium', 'system', '2026-06-28T02:31:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Black search text, fix chart threshold and domain' and created_at = '2026-06-28T02:31:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix chart TypeScript errors', 'Fix chart TypeScript errors [commit 21343fa]', 'Done', 'Medium', 'system', '2026-06-28T02:13:25+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix chart TypeScript errors' and created_at = '2026-06-28T02:13:25+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update employee chart to show attendance, accuracy, efficiency and overall', 'Update employee chart to show attendance, accuracy, efficiency and overall [commit e493f1f]', 'Done', 'Medium', 'system', '2026-06-28T02:11:34+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update employee chart to show attendance, accuracy, efficiency and overall' and created_at = '2026-06-28T02:11:34+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Extend year range to 2030 for KPI entry and dashboards', 'Extend year range to 2030 for KPI entry and dashboards [commit 73d168d]', 'Done', 'Medium', 'system', '2026-06-28T02:09:43+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Extend year range to 2030 for KPI entry and dashboards' and created_at = '2026-06-28T02:09:43+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Grouped employee view by name with expandable roles', 'Grouped employee view by name with expandable roles [commit 9cfd5b3]', 'Done', 'Medium', 'system', '2026-06-28T01:44:28+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Grouped employee view by name with expandable roles' and created_at = '2026-06-28T01:44:28+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Full user management from Supabase — no Vercel needed', 'Full user management from Supabase — no Vercel needed [commit 4ae23f8]', 'Done', 'Medium', 'system', '2026-06-28T01:38:10+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Full user management from Supabase — no Vercel needed' and created_at = '2026-06-28T01:38:10+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update add-user to use Supabase', 'Update add-user to use Supabase [commit 883c679]', 'Done', 'Medium', 'system', '2026-06-28T01:37:16+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update add-user to use Supabase' and created_at = '2026-06-28T01:37:16+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update change-password to use Supabase', 'Update change-password to use Supabase [commit 6b8f44e]', 'Done', 'Medium', 'system', '2026-06-28T01:37:15+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update change-password to use Supabase' and created_at = '2026-06-28T01:37:15+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Move auth to Supabase app_users table', 'Move auth to Supabase app_users table [commit 2412dec]', 'Done', 'Medium', 'system', '2026-06-28T01:37:14+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Move auth to Supabase app_users table' and created_at = '2026-06-28T01:37:14+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add user API route', 'Add user API route [commit 93a5eb5]', 'Done', 'Medium', 'system', '2026-06-28T01:33:27+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add user API route' and created_at = '2026-06-28T01:33:27+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Black input text, expandable notes, user management', 'Black input text, expandable notes, user management [commit 0f8c983]', 'Done', 'Medium', 'system', '2026-06-28T01:33:26+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Black input text, expandable notes, user management' and created_at = '2026-06-28T01:33:26+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Audit log, active-only performance, status toggle, edit scores', 'Audit log, active-only performance, status toggle, edit scores [commit 6d7a129]', 'Done', 'Medium', 'system', '2026-06-28T01:26:20+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Audit log, active-only performance, status toggle, edit scores' and created_at = '2026-06-28T01:26:20+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add perf toggle, team view, edit scores, team lead assignment', 'Add perf toggle, team view, edit scores, team lead assignment [commit 6a58af8]', 'Done', 'Medium', 'system', '2026-06-28T01:08:26+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add perf toggle, team view, edit scores, team lead assignment' and created_at = '2026-06-28T01:08:26+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix Supabase URL typo', 'Fix Supabase URL typo [commit 93e61db]', 'Done', 'Medium', 'system', '2026-06-28T00:55:57+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix Supabase URL typo' and created_at = '2026-06-28T00:55:57+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete debug page', 'Delete debug page [commit 03becb9]', 'Done', 'Medium', 'system', '2026-06-28T00:49:36+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete debug page' and created_at = '2026-06-28T00:49:36+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'app/debug/page.tsx', 'Fix: app/debug/page.tsx [commit dd9a741]', 'Done', 'Medium', 'system', '2026-06-27T23:43:31+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'app/debug/page.tsx' and created_at = '2026-06-27T23:43:31+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'next.config.ts', 'Fix: next.config.ts [commit 8ef0875]', 'Done', 'Medium', 'system', '2026-06-27T23:41:53+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'next.config.ts' and created_at = '2026-06-27T23:41:53+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'app/debug/page.tsx', 'Fix: app/debug/page.tsx [commit e2e9182]', 'Done', 'Medium', 'system', '2026-06-27T23:30:04+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'app/debug/page.tsx' and created_at = '2026-06-27T23:30:04+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', '_trigger.txt', 'Fix: _trigger.txt [commit f5cb722]', 'Done', 'Medium', 'system', '2026-06-27T23:27:50+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = '_trigger.txt' and created_at = '2026-06-27T23:27:50+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'lib/supabase.ts', 'Fix: lib/supabase.ts [commit 2eea900]', 'Done', 'Medium', 'system', '2026-06-27T23:27:49+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'lib/supabase.ts' and created_at = '2026-06-27T23:27:49+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'lib/supabase.ts', 'Fix: lib/supabase.ts [commit 23a64d8]', 'Done', 'Medium', 'system', '2026-06-27T23:21:51+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'lib/supabase.ts' and created_at = '2026-06-27T23:21:51+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add app/api/debug/route.ts', 'Add app/api/debug/route.ts [commit 18edabd]', 'Done', 'Medium', 'system', '2026-06-27T23:20:11+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add app/api/debug/route.ts' and created_at = '2026-06-27T23:20:11+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update app/layout.tsx', 'Update app/layout.tsx [commit c8014de]', 'Done', 'Medium', 'system', '2026-06-27T23:01:45+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update app/layout.tsx' and created_at = '2026-06-27T23:01:45+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update components/KPIApp.tsx', 'Update components/KPIApp.tsx [commit 337b8eb]', 'Done', 'Medium', 'system', '2026-06-27T23:01:44+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update components/KPIApp.tsx' and created_at = '2026-06-27T23:01:44+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add public/ab-logo.png', 'Add public/ab-logo.png [commit 57adfd5]', 'Done', 'Medium', 'system', '2026-06-27T23:00:28+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add public/ab-logo.png' and created_at = '2026-06-27T23:00:28+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update components/KPIApp.tsx', 'Update components/KPIApp.tsx [commit f4fceb3]', 'Done', 'Medium', 'system', '2026-06-27T22:55:31+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update components/KPIApp.tsx' and created_at = '2026-06-27T22:55:31+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update teams-schema.sql', 'Update teams-schema.sql [commit f474630]', 'Done', 'Medium', 'system', '2026-06-27T22:43:21+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update teams-schema.sql' and created_at = '2026-06-27T22:43:21+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update components/KPIApp.tsx', 'Update components/KPIApp.tsx [commit cf8cdde]', 'Done', 'Medium', 'system', '2026-06-27T22:43:20+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update components/KPIApp.tsx' and created_at = '2026-06-27T22:43:20+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'public/.gitkeep', 'Fix: public/.gitkeep [commit ead2434]', 'Done', 'Medium', 'system', '2026-06-27T22:34:50+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'public/.gitkeep' and created_at = '2026-06-27T22:34:50+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'vercel.json', 'Fix: vercel.json [commit 40c867a]', 'Done', 'Medium', 'system', '2026-06-27T22:34:49+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'vercel.json' and created_at = '2026-06-27T22:34:49+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Fix tsconfig.json', 'Fix tsconfig.json [commit f1e5fdf]', 'Done', 'Medium', 'system', '2026-06-27T22:31:01+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Fix tsconfig.json' and created_at = '2026-06-27T22:31:01+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted _deploy.txt', 'Delete corrupted _deploy.txt [commit e10a19e]', 'Done', 'Medium', 'system', '2026-06-27T22:31:01+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted _deploy.txt' and created_at = '2026-06-27T22:31:01+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted CLAUDE.md', 'Delete corrupted CLAUDE.md [commit 7a15dd1]', 'Done', 'Medium', 'system', '2026-06-27T22:31:00+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted CLAUDE.md' and created_at = '2026-06-27T22:31:00+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted vercel.svg', 'Delete corrupted vercel.svg [commit a6f6a59]', 'Done', 'Medium', 'system', '2026-06-27T22:30:59+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted vercel.svg' and created_at = '2026-06-27T22:30:59+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted next.svg', 'Delete corrupted next.svg [commit 14a54db]', 'Done', 'Medium', 'system', '2026-06-27T22:30:59+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted next.svg' and created_at = '2026-06-27T22:30:59+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted file.svg', 'Delete corrupted file.svg [commit d7353b9]', 'Done', 'Medium', 'system', '2026-06-27T22:30:58+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted file.svg' and created_at = '2026-06-27T22:30:58+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted download', 'Delete corrupted download [commit e2919a8]', 'Done', 'Medium', 'system', '2026-06-27T22:30:57+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted download' and created_at = '2026-06-27T22:30:57+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted supabase.ts', 'Delete corrupted supabase.ts [commit 81fcf5d]', 'Done', 'Medium', 'system', '2026-06-27T22:30:57+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted supabase.ts' and created_at = '2026-06-27T22:30:57+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted KPIApp.tsx', 'Delete corrupted KPIApp.tsx [commit 0d9dc6b]', 'Done', 'Medium', 'system', '2026-06-27T22:30:56+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted KPIApp.tsx' and created_at = '2026-06-27T22:30:56+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted page.tsx', 'Delete corrupted page.tsx [commit d8c0f84]', 'Done', 'Medium', 'system', '2026-06-27T22:30:55+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted page.tsx' and created_at = '2026-06-27T22:30:55+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Delete corrupted route.ts', 'Delete corrupted route.ts [commit 1313266]', 'Done', 'Medium', 'system', '2026-06-27T22:30:54+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Delete corrupted route.ts' and created_at = '2026-06-27T22:30:54+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', '_deploy.txt', 'Fix: _deploy.txt [commit 407b2c4]', 'Done', 'Medium', 'system', '2026-06-27T22:15:41+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = '_deploy.txt' and created_at = '2026-06-27T22:15:41+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'deploy correct next.config.ts', 'Fix: deploy correct next.config.ts [commit a1d799f]', 'Done', 'Medium', 'system', '2026-06-27T22:15:09+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'deploy correct next.config.ts' and created_at = '2026-06-27T22:15:09+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Issue', 'deploy correct package.json', 'Fix: deploy correct package.json [commit 64a19c7]', 'Done', 'Medium', 'system', '2026-06-27T22:15:08+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'deploy correct package.json' and created_at = '2026-06-27T22:15:08+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add tailwind.config.ts', 'Add tailwind.config.ts [commit e7b3532]', 'Done', 'Medium', 'system', '2026-06-27T22:13:31+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add tailwind.config.ts' and created_at = '2026-06-27T22:13:31+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add tsconfig.json', 'Add tsconfig.json [commit 08a0347]', 'Done', 'Medium', 'system', '2026-06-27T22:13:31+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add tsconfig.json' and created_at = '2026-06-27T22:13:31+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add postcss.config.mjs', 'Add postcss.config.mjs [commit 55b7a05]', 'Done', 'Medium', 'system', '2026-06-27T22:13:30+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add postcss.config.mjs' and created_at = '2026-06-27T22:13:30+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add next.config.ts', 'Add next.config.ts [commit 247502e]', 'Done', 'Medium', 'system', '2026-06-27T22:13:29+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add next.config.ts' and created_at = '2026-06-27T22:13:29+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add lib/supabase.ts', 'Add lib/supabase.ts [commit 61d68b8]', 'Done', 'Medium', 'system', '2026-06-27T22:13:28+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add lib/supabase.ts' and created_at = '2026-06-27T22:13:28+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add components/KPIApp.tsx', 'Add components/KPIApp.tsx [commit d72a5a8]', 'Done', 'Medium', 'system', '2026-06-27T22:13:28+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add components/KPIApp.tsx' and created_at = '2026-06-27T22:13:28+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add app/api/auth/login/route.ts', 'Add app/api/auth/login/route.ts [commit 0e76fd0]', 'Done', 'Medium', 'system', '2026-06-27T22:13:27+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add app/api/auth/login/route.ts' and created_at = '2026-06-27T22:13:27+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add app/page.tsx', 'Add app/page.tsx [commit 52e79d5]', 'Done', 'Medium', 'system', '2026-06-27T22:13:26+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add app/page.tsx' and created_at = '2026-06-27T22:13:26+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add app/globals.css', 'Add app/globals.css [commit 45ada2d]', 'Done', 'Medium', 'system', '2026-06-27T22:13:25+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add app/globals.css' and created_at = '2026-06-27T22:13:25+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add app/layout.tsx', 'Add app/layout.tsx [commit 0782dc7]', 'Done', 'Medium', 'system', '2026-06-27T22:13:24+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add app/layout.tsx' and created_at = '2026-06-27T22:13:24+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Create globals.css', 'Create globals.css [commit e1e43fc]', 'Done', 'Medium', 'system', '2026-06-27T21:55:47+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Create globals.css' and created_at = '2026-06-27T21:55:47+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Create layout.tsx', 'Create layout.tsx [commit 4defbab]', 'Done', 'Medium', 'system', '2026-06-27T21:53:46+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Create layout.tsx' and created_at = '2026-06-27T21:53:46+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Update package.json', 'Update package.json [commit b286f54]', 'Done', 'Medium', 'system', '2026-06-27T21:44:17+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Update package.json' and created_at = '2026-06-27T21:44:17+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add files via upload', 'Add files via upload [commit 7a1e220]', 'Done', 'Medium', 'system', '2026-06-27T21:34:00+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add files via upload' and created_at = '2026-06-27T21:34:00+08:00'::timestamptz);

insert into dev_matrix (category, title, description, status, priority, created_by, created_at)
select 'Feature', 'Add files via upload', 'Add files via upload [commit 80f63e7]', 'Done', 'Medium', 'system', '2026-06-27T21:28:59+08:00'::timestamptz
where not exists (select 1 from dev_matrix where title = 'Add files via upload' and created_at = '2026-06-27T21:28:59+08:00'::timestamptz);

