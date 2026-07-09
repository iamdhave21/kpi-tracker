-- Expands dev_matrix's category/status options. The original 3 categories
-- (Feature/Issue/Pending SQL) and 3 statuses (Open/In Progress/Done) were
-- too narrow for the range of work actually logged this session (security
-- fixes, RLS fixes, refactors, docs) and had no way to mark something
-- "Blocked" (e.g. the Supabase key rotation waiting on their incident).

alter table dev_matrix drop constraint if exists dev_matrix_category_check;
alter table dev_matrix add constraint dev_matrix_category_check
  check (category in ('Feature','Issue','Pending SQL','Security Fix','RLS Fix','Refactor','Documentation'));

alter table dev_matrix drop constraint if exists dev_matrix_status_check;
alter table dev_matrix add constraint dev_matrix_status_check
  check (status in ('Open','In Progress','Blocked','Done'));
