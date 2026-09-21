-- Weekly Antivirus Scan Compliance -- new table + new PRIVATE storage bucket.
-- Run this once in the Supabase SQL Editor before the AV Scan panel is used.
--
-- Unlike every other bucket in this app (`attachments`, `avatars`, both
-- public), `av-scans` is created private on purpose -- these screenshots
-- show someone's own desktop/installed software, and the app reads them
-- back with a short-lived signed URL (see AVScanPanel.viewScreenshot in
-- components/KPIApp.tsx) instead of a permanent public link.
--
-- Honest caveat, stated here too, not just in code comments: the
-- storage.objects policies below are `using (true)` for the av-scans
-- bucket, matching every other bucket's policies in this project today
-- (checked directly: attachments/avatars are the same shape). That means
-- being private stops a permanent, publicly-cacheable URL from existing --
-- a real improvement over this app's usual pattern -- but it does not by
-- itself restrict WHO can ask for a signed URL. Real per-user storage
-- access control would need Supabase Auth-based policies, which this app
-- only has for Google-signed-in users, not the password-login admin path.
-- That's the same gap AUDIT.md C2 already covers project-wide -- not
-- solved here as a one-off for this one feature.

create table public.av_scan_submissions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  employee_name text,
  employee_email text not null,
  week_start date not null,
  scan_type text not null check (scan_type in ('quick','full')),
  storage_path text not null,
  submitted_at timestamptz not null default now(),
  screenshot_deleted_at timestamptz,
  unique (employee_email, week_start, scan_type)
);

-- RLS on this table's own metadata is deliberately using(true) -- the same
-- pattern as every other table in this app (AUDIT.md C2). The actual new
-- protection in this feature is the bucket being private; adding a
-- stricter model for just this one table's rows would be an inconsistency
-- to explain later, not a real security improvement on its own.
alter table public.av_scan_submissions enable row level security;
create policy av_scan_submissions_all on public.av_scan_submissions for all using (true) with check (true);

insert into storage.buckets (id, name, public) values ('av-scans', 'av-scans', false);

-- Without these, uploads AND signed-URL generation both fail outright --
-- storage.objects has RLS on with zero policies by default for a new
-- bucket, which is deny-all, not "inherit whatever the bucket's public
-- flag says." Scoped to bucket_id = 'av-scans' only, same shape as the
-- existing per-bucket policies on attachments/avatars.
create policy "av-scans insert" on storage.objects for insert to public with check (bucket_id = 'av-scans');
create policy "av-scans select" on storage.objects for select to public using (bucket_id = 'av-scans');
create policy "av-scans update" on storage.objects for update to public using (bucket_id = 'av-scans');
create policy "av-scans delete" on storage.objects for delete to public using (bucket_id = 'av-scans');
