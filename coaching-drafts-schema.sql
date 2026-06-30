-- ============================================================
-- Coaching session drafts
-- Lets Team Leads start a coaching log, save it as a draft without
-- submitting, and come back later to finish before the actual session.
-- ============================================================

alter table coaching_logs add column if not exists status text not null default 'Final';

-- Existing rows are all real, already-submitted sessions, so they
-- default correctly to 'Final' above -- nothing else needed.

create index if not exists coaching_logs_status_idx on coaching_logs(status);
