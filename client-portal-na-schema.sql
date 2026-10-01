-- Client Portal: "Not Applicable" support for Handover Pack items.
-- Two ways an item can end up N/A, per explicit decision to do both:
-- (1) the client marks it N/A themselves from their own checklist, or
-- (2) Staff pre-marks it N/A when creating the pack, for an item that
--     plainly doesn't apply to that client's business before they ever
--     see it. Either way it's the SAME flag -- not_applicable -- so
--     "resolved" (received OR not_applicable) is one simple concept
--     everywhere this is read. Run once in the Supabase SQL Editor.

alter table public.handover_pack_submissions add column not_applicable boolean not null default false;
alter table public.handover_pack_submissions add column na_reason text;
alter table public.handover_pack_submissions add column na_by text;
alter table public.handover_pack_submissions add column na_at timestamptz;
