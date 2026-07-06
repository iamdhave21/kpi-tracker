-- Fix: directory_links has RLS enabled but is missing INSERT/UPDATE/DELETE
-- policies (likely missed during the RLS enablement sprint). This follows
-- the same permissive pattern used on other tables like coaching_logs --
-- real role-gating (super_admin/admin only) is enforced client-side in the
-- app before these buttons are even shown, not at the database layer,
-- since the app uses its own app_users table rather than Supabase Auth.

alter table directory_links enable row level security;

drop policy if exists "Allow read" on directory_links;
create policy "Allow read" on directory_links for select using (true);

drop policy if exists "Allow insert" on directory_links;
create policy "Allow insert" on directory_links for insert with check (true);

drop policy if exists "Allow update" on directory_links;
create policy "Allow update" on directory_links for update using (true) with check (true);

drop policy if exists "Allow delete" on directory_links;
create policy "Allow delete" on directory_links for delete using (true);
