-- Dev Matrix catch-up for the October 2026 phase (21 entries).
-- Run the SIX blocks one at a time, in order. Each should say "Success. No rows returned".
-- The SQL editor can truncate long pastes, so each block is small on purpose.
-- Verify afterwards:  select count(*) from dev_matrix where created_at > now() - interval '2 hours';   (expect 21)

-- ===== BLOCK 1 of 6 =====
insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
('Feature', 'Client Portal phases 1-2: handover pack, magic-link sign-in, readiness pie, Not Applicable both ways',
 'Client contacts sign in by emailed single-use link (24 h) with no password. Shared 31-item Handover Pack template with per-client records, gaps log, client-side and staff-side Not Applicable, contact dropdown when creating a pack, and a Go-Live Readiness card showing only the Critical-items percentage to the client. Built and compiled; live verification of N/A, the readiness pie and the ops email is still pending.', 'In Progress', 'High', 'Dhave Latimer', now()),
('Feature', 'Client Requests: seven request types, approvals, alerts and routing',
 'Clients send headcount, process change, escalation, commendation, complaint, commercial change and general requests with attachments (private bucket, 4 MB cap). Staff inbox with status, assignee, effectivity date, replies versus internal notes, approvers and receivers, and admin-only alert routing. Tables are locked (RLS on, no policies) and reached only through server routes. Built; end-to-end live test still pending.', 'In Progress', 'High', 'Dhave Latimer', now()),
('Feature', 'Client Observations: internal log of what staff experience with a client',
 'Client, event date, type, tone, significance, people involved, optional follow-up. Admins see all; a Team Lead sees their own entries plus the clients they support; others see only their own. Clients never see it. No attachments (links only). Built; live verification pending.', 'In Progress', 'Medium', 'Dhave Latimer', now()),
('Feature', 'Access and Tools Repository (Internal Management)',
 'One row per tool, subscription or access account with owner, admin holder, renewal and payment dates, notice period, seats and cost. Sorted by what needs attention soonest, month-end-safe Mark renewed, run-rate per currency. Never stores passwords, keys or card numbers. No renewal emails yet. Built; live verification pending.', 'In Progress', 'Medium', 'Dhave Latimer', now());

-- ===== BLOCK 2 of 6 =====
insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
('Feature', 'BCP departments and Escalation Matrix tab with clickable process map',
 'BCP departments are Operations, Payroll, Recruitment, Client Management and IT. Escalation Matrix (AB-ESC-01, draft) shown as collapsible sections with five diagrams; the Start Here map has 21 clickable boxes linking to their sections. Task content for the BCP matrix is still pending from the business.', 'Done', 'Medium', 'Dhave Latimer', now()),
('Security Fix', 'Closed the public debug route, locked client auth tables, rate-limited sign-in links, honest upload limit',
 'Removed /api/debug (public, leaked a key preview and employee names). Dropped the open policies on client_login_tokens and client_sessions (deny-all to the public key, verified). Sign-in links limited to 5 emails per contact per hour. Upload limit changed to 4 MB with a clear message because Vercel rejects bodies over about 4.5 MB.', 'Done', 'High', 'Dhave Latimer', now()),
('Issue', 'Month-boundary dates were off by one day in the Philippines (fixed in 7 places) and text unreadable on dark-mode systems',
 'Building a month range with new Date(y, m, 1).toISOString() lands on the previous day at UTC+8, which dropped Sept 30 and included Aug 31 in some totals. Now uses local dates. Separately, globals.css switched body text to near-white on dark-mode systems; the app is pinned to a light color scheme until a proper dark mode is built.', 'Done', 'High', 'Dhave Latimer', now()),
('Feature', 'SOP and LWI Repository: versioned documents, approvals and acknowledgment',
 'Documents with versions, content cards (text, link, files and screenshots), approvers (all must approve), receivers and acknowledgment; a new version makes everyone acknowledge again. Files in the private bucket with 5-minute signed URLs. Five tables locked at the database and reached only through a Google-verified server route.', 'Done', 'High', 'Dhave Latimer', now());

-- ===== BLOCK 3 of 6 =====
insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
('Feature', 'SOP: Add document with approval proof, process change log and logged edits to a live page',
 'A document already approved elsewhere (for example by the client) goes live with who approved, when and how, plus screenshots (managers only can open them). Process changes start the next version and need re-acknowledgment. Small fixes to a live page need a note and are logged with the content as it was. Team Leads who support the document client can maintain it. Proof and change entries are append-only; only an Admin deletes, and it is logged.', 'Done', 'High', 'Dhave Latimer', now()),
('Feature', 'SOP: standard document numbers, SOP versus LWI explainer, and client scoping',
 'Numbers are CAMPAIGN-TYPE-MMDDYY (AR-SOP-100826), built from three fields and enforced on the server; a same-day clash becomes -2, -3. SOP is the goal and LWI is the step by step. Client is scoped both ways: Admins pick any client or none, a Team Lead only a client they support; a client document goes only to the people who support that client.', 'Done', 'Medium', 'Dhave Latimer', now()),
('Security Fix', 'Tickets scoped by role, POC and team; Override Owner picker fixed',
 'Everyone sees tickets they filed, tickets assigned to them and every ticket in a category they are a POC for. Team Lead adds their team (teams and team_members); Manager adds Agents and Team Leads but not other Managers or the Super Admin; Super Admin sees all. View As now reloads when the previewed person changes (it used to keep the Super Admin list). Override Owner picker was rebuilt on every keystroke so delete failed, typed text was saved as the owner, and the override was ignored when the category had a POC; all fixed, with a Remove chip. Enforced in the app only; database lock is part of the hardening item.', 'Done', 'High', 'Dhave Latimer', now());

-- ===== BLOCK 4 of 6 =====
insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
('Feature', 'Tasks module removed',
 'Removed the screen, sidebar entry and badge, the notify and cron routes, and the schema files. Task completion no longer counts toward the KPI Compliance score, Team Compliance, the daily reminder email or the Ops Dashboard (the Task card was retired and saved card orders migrated). Past months recompute without tasks because scores are calculated live. The tasks table itself was kept (30 rows).', 'Done', 'Medium', 'Dhave Latimer', now()),
('Issue', 'TL Scorecard: KPI Entry Compliance measured the Team Lead own record, which she cannot create',
 'It first counted any record company-wide, then only a record about the Team Lead herself, so entering her whole team scores never moved it. It now measures the share of her active team members with a KPI record for the month, honours the team filter, and is left out of the average when she has no active members. Attendance still reads her own record, entered by management.', 'Done', 'High', 'Dhave Latimer', now()),
('Feature', 'Hire date on every employee record, synced across Employees and HRIS Employee Records',
 'employees.hire_date is the single source for tenure. Required when adding a person; editable on Employees and (Admin/Super Admin) on HRIS Employee Records; shown with tenure, included in the export, kept equal on every row of a person who has one row per client, logged in the audit trail and not included in the notification email. 23 dates were loaded from the internal list.', 'Done', 'Medium', 'Dhave Latimer', now());

-- ===== BLOCK 5 of 6 =====
insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
('Feature', 'Bonus Review (Super Admin only) under Operations',
 'Pick a period (annual, monthly or any range), switch criteria on or off with thresholds (tenure, attendance, overall performance, Notices to Explain, escalations), set a per-person amount or a budget shared equally, add tenure tiers and a basket. Exceptions and the Notice-to-Explain gatekeeper (cannot be overridden), a per-person tenure bonus amount, filters, saved presets and saved runs, print or PDF. Reads live data on the server; presets and runs in two locked tables. Annual preset: 12+ months starts at 8,000 and reaches 8,500 with a 97 percent average on 2026 scores.', 'Done', 'Medium', 'Dhave Latimer', now()),
('Documentation', 'Access Guide and Manual brought up to date for the October phase',
 'Removed Tasks. Added rows and entries for Ops Dashboard, SOP and LWI, Bonus Review, Access and Tools Repository, Project Management Tool, Client Observations, Client Requests, Client Onboarding and Employees; updated Tickets scoping, Employee Records hire date, Team Lead Scorecard and KPI Entry notes.', 'Done', 'Low', 'Dhave Latimer', now()),
('Pending SQL', 'Drop the old tasks table after exporting a CSV',
 'The Tasks module is gone and nothing reads the table. It holds 30 rows. Export first if a copy is wanted, then drop table if exists tasks. Suggested to wait about a week.', 'Open', 'Low', 'Dhave Latimer', now()),
('Issue', 'Wide-open tables still readable with the public key: tickets, KPI records, employees, HRIS documents and others',
 'Access control for these lives in the app only. Employees now also holds hire dates, so this matters more. Real database locks, server-checked staff sessions app-wide and login lockout are the hardening item. New sensitive tables should be locked from day one (the pattern used for client requests, SOP and Bonus Review).', 'Open', 'High', 'Dhave Latimer', now());

-- ===== BLOCK 6 of 6 =====
insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
('Issue', 'Open email endpoints and staff-file route still trust the caller',
 '/api/notify/client-portal-welcome and /api/notify/client-portal-submission accept any recipient from anyone who knows the URL (mail relay and phishing risk), the other /api/notify routes are not audited, and /api/client-portal/staff-file identifies staff by a claimed email. Fix: send mail from the server only and use the verified-token check.', 'Open', 'High', 'Dhave Latimer', now()),
('Issue', 'Four case-sensitive email lookups remain on the Employees, Coaching and Scorecard screens',
 'The same bug class that locked a mixed-case account out of login: .eq on an email or created_by value instead of a case-insensitive match. To be fixed one at a time with a test each, as part of the code tidy-up.', 'Open', 'Medium', 'Dhave Latimer', now()),
('Refactor', 'Code tidy-up: split the 13,000-line KPIApp.tsx into one file per screen, remove 39 unused pieces, fix linting',
 'Plan: slice 1 tooling and unused code, then move screens five at a time with an automated proof that moved code is identical, then shared helpers, then the email lookups. Each slice on its own branch, confirmed before main. Rollback tag before-tidy should be moved to the latest main first.', 'Open', 'Medium', 'Dhave Latimer', now());
