-- Changes the Full Scan cadence from "once a week" to "once a month".
-- Quick Scan is unchanged -- still weekly.
--
-- Run this BEFORE merging/deploying the corresponding code change (the
-- new code queries a `period_key` column that doesn't exist until this
-- runs). Safe to run against live data with real submissions already in
-- the table -- checked directly before writing this: 10 rows exist as of
-- 2026-09-22, all from the first week this feature was live (2026-09-20),
-- 5 quick + 5 full. All 5 existing 'full' rows are reinterpreted as
-- belonging to September 2026 below -- those 5 people are NOT asked to
-- resubmit for this month.
--
-- Zero-downtime design: this does NOT drop the old unique constraint
-- (employee_email, week_start, scan_type). It adds a NEW one instead
-- (employee_email, period_key, scan_type) and leaves both in place.
-- Reasoning: the moment this SQL runs, `period_key` exists and is
-- populated, but the OLD app code (still live until the Vercel deploy
-- finishes) keeps upserting against the OLD constraint by name. If the
-- old constraint were dropped here, any submission attempt in that gap
-- window would fail outright (Postgres errors when an upsert's
-- ON CONFLICT target doesn't match a real constraint). Leaving the old
-- constraint in place costs nothing -- it's still valid, just no longer
-- read by the new code -- and removes that gap entirely.

alter table public.av_scan_submissions add column period_key text;

-- Quick keeps the same value it already had (week_start already IS its
-- weekly period identity).
update public.av_scan_submissions set period_key = week_start::text where scan_type = 'quick';

-- Full is reinterpreted as the month the existing week fell in.
update public.av_scan_submissions set period_key = to_char(week_start, 'YYYY-MM') where scan_type = 'full';

alter table public.av_scan_submissions alter column period_key set not null;

alter table public.av_scan_submissions
  add constraint av_scan_submissions_employee_email_period_key_scan_type_key
  unique (employee_email, period_key, scan_type);

-- Optional, no rush: once the new code has been live a while and nobody
-- is depending on the old constraint any more, it can be dropped for
-- tidiness --
--   alter table public.av_scan_submissions drop constraint av_scan_submissions_employee_email_week_start_scan_type_key;
-- Left commented out on purpose. It is harmless to leave in place
-- indefinitely, so there's no need to run this unless you want the
-- schema to read cleanly.

-- Verify before moving on:
--   select scan_type, period_key, count(*) from av_scan_submissions group by 1,2 order by 1,2;
-- Expect: 5 'quick' rows on 2026-09-20 (unchanged), 5 'full' rows now on
-- 2026-09 (the month), no nulls, no errors.
