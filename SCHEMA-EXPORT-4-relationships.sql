-- ============================================================
-- CURRENT STATE SCHEMA EXPORT — Part 4: Relationships (Foreign Keys)
-- ============================================================

select
  tc.table_name as table_with_foreign_key,
  kcu.column_name as foreign_key_column,
  ccu.table_name as references_table,
  ccu.column_name as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
and tc.table_schema = 'public'
order by tc.table_name;
