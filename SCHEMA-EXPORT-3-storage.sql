-- ============================================================
-- CURRENT STATE SCHEMA EXPORT — Part 3: Storage Buckets
-- ============================================================

select id as bucket_name, public, created_at
from storage.buckets
order by id;

-- Storage object policies (separate from bucket settings)
select policyname, cmd as operation, roles
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
