-- Diagnostic: find every table that has RLS enabled but is missing an
-- INSERT, UPDATE, or DELETE policy. These are the tables at risk of the
-- same "new row violates row-level security policy" error we hit on
-- directory_links and announcements.
--
-- v2: a single "FOR ALL" policy covers insert+update+delete together and
-- shows as cmd = 'ALL' in pg_policies rather than three separate rows --
-- the first version of this query missed that and produced false positives
-- for tables like employees/kpi_records/teams that already work fine.

select
  t.tablename,
  bool_or(p.cmd in ('INSERT','ALL')) as has_insert_policy,
  bool_or(p.cmd in ('UPDATE','ALL')) as has_update_policy,
  bool_or(p.cmd in ('DELETE','ALL')) as has_delete_policy
from pg_tables t
left join pg_policies p on p.tablename = t.tablename and p.schemaname = 'public'
where t.schemaname = 'public'
  and t.rowsecurity = true
group by t.tablename
having bool_or(p.cmd in ('INSERT','ALL')) is not true
    or bool_or(p.cmd in ('UPDATE','ALL')) is not true
    or bool_or(p.cmd in ('DELETE','ALL')) is not true
order by t.tablename;

