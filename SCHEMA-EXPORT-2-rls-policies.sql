-- ============================================================
-- CURRENT STATE SCHEMA EXPORT — Part 2: RLS Policies
-- ============================================================

select
  tablename,
  policyname,
  cmd as operation,
  roles,
  qual as using_clause,
  with_check as check_clause
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
