-- ============================================================================
-- Remove the old `tasks` table (the Tasks screen was removed in Oct 2026).
-- The code has NO references to this table (checked in the repo), and the
-- task-reminders cron route is already gone. These blocks check the DATABASE
-- side too. Run ONE block at a time. Blocks 1-6 only read; block 8 drops.
-- NOTE: `bcp_tasks` and `bcp_task_coverage` are different tables (the BCP
-- screen). Nothing here touches them.
-- ============================================================================

-- BLOCK 1: does it exist, and how many rows? (expected: 30)
select count(*) as task_rows from public.tasks;

-- BLOCK 2: does any OTHER table point at tasks with a foreign key? (expected: no rows)
select conrelid::regclass as from_table, conname from pg_constraint where contype = 'f' and confrelid = 'public.tasks'::regclass;

-- BLOCK 3: does any view use tasks? (expected: no rows)
select view_name from information_schema.view_table_usage where table_schema = 'public' and table_name = 'tasks';

-- BLOCK 4: does any function or trigger mention tasks? (expected: no rows)
-- The pattern \mtasks\M matches the whole word only, so bcp_tasks is not matched.
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ~* '\mtasks\M';

-- BLOCK 5: triggers that live ON the tasks table itself (expected: no rows, or only internal ones)
select tgname from pg_trigger where tgrelid = 'public.tasks'::regclass and not tgisinternal;

-- BLOCK 6: any scheduled job (pg_cron) that touches tasks? (expected: no rows)
-- If this says "relation cron.job does not exist", pg_cron is not used: that is fine.
select jobname, schedule from cron.job where command ~* '\mtasks\M';

-- BLOCK 7: EXPORT FIRST. Run this, then use the "Download CSV" button on the
-- results panel and keep the file. After this the data cannot be recovered.
select * from public.tasks order by 1;

-- BLOCK 8: THE DROP. Deliberately no CASCADE: if something still depends on
-- the table, Postgres refuses and nothing is deleted.
drop table public.tasks;

-- BLOCK 9: confirm it is gone (expected: 0 rows)
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'tasks';
