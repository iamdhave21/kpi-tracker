-- ============================================================
-- SOFT LAUNCH READINESS CHECK
-- Run this once and send me the full results.
-- It tells us exactly what tables/columns/buckets exist vs. are missing
-- across everything built so far, so we know what's safe to demo.
-- ============================================================

select 'TABLE: ' || table_name as item, 'EXISTS' as status
from information_schema.tables
where table_schema = 'public'
and table_name in (
  'employees', 'app_users', 'kpi_records', 'teams', 'team_members',
  'announcements', 'announcement_acks', 'audit_log', 'app_settings',
  'coaching_logs', 'hris_referrals', 'hris_documents', 'tickets',
  'dev_matrix', 'bcp_tasks', 'bcp_task_coverage'
)
order by table_name;

-- Storage buckets
select 'BUCKET: ' || id as item, 'EXISTS' as status
from storage.buckets
where id in ('attachments', 'avatars')
order by id;

-- Key columns that were added incrementally across sessions
select 'COLUMN: employees.employee_id' as item,
  case when exists (select 1 from information_schema.columns where table_name='employees' and column_name='employee_id') then 'EXISTS' else 'MISSING' end as status
union all
select 'COLUMN: employees.departments',
  case when exists (select 1 from information_schema.columns where table_name='employees' and column_name='departments') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: employees.employment_type',
  case when exists (select 1 from information_schema.columns where table_name='employees' and column_name='employment_type') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: employees.client',
  case when exists (select 1 from information_schema.columns where table_name='employees' and column_name='client') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: app_users.avatar_url',
  case when exists (select 1 from information_schema.columns where table_name='app_users' and column_name='avatar_url') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: app_users.display_name',
  case when exists (select 1 from information_schema.columns where table_name='app_users' and column_name='display_name') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: coaching_logs.requires_acknowledgment',
  case when exists (select 1 from information_schema.columns where table_name='coaching_logs' and column_name='requires_acknowledgment') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: coaching_logs.agent_acknowledged',
  case when exists (select 1 from information_schema.columns where table_name='coaching_logs' and column_name='agent_acknowledged') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: hris_documents.is_private',
  case when exists (select 1 from information_schema.columns where table_name='hris_documents' and column_name='is_private') then 'EXISTS' else 'MISSING' end
union all
select 'COLUMN: tickets.department',
  case when exists (select 1 from information_schema.columns where table_name='tickets' and column_name='department') then 'EXISTS' else 'MISSING' end
order by 1;
