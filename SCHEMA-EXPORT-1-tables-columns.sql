-- ============================================================
-- CURRENT STATE SCHEMA EXPORT
-- Run this in Supabase and save the full output. This shows the
-- database EXACTLY as it stands today -- not how it was built
-- historically, just what's actually there right now.
-- ============================================================

-- 1. All tables and their columns, with types and nullability
select
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.tables t
join information_schema.columns c
  on c.table_name = t.table_name and c.table_schema = 'public'
where t.table_schema = 'public'
and t.table_type = 'BASE TABLE'
order by t.table_name, c.ordinal_position;
