-- Diagnostic: find every table that has RLS enabled but is missing an
-- INSERT, UPDATE, or DELETE policy. These are the tables at risk of the
-- same "new row violates row-level security policy" error we hit on
-- directory_links and announcements.

select
  t.tablename,
  bool_or(p.cmd = 'INSERT') as has_insert_policy,
  bool_or(p.cmd = 'UPDATE') as has_update_policy,
  bool_or(p.cmd = 'DELETE') as has_delete_policy
from pg_tables t
left join pg_policies p on p.tablename = t.tablename and p.schemaname = 'public'
where t.schemaname = 'public'
  and t.rowsecurity = true
group by t.tablename
having bool_or(p.cmd = 'INSERT') is not true
    or bool_or(p.cmd = 'UPDATE') is not true
    or bool_or(p.cmd = 'DELETE') is not true
order by t.tablename;
