-- Game score approvals had no record of who approved/rejected them, and no
-- audit log entry was ever written for these actions -- both are now fixed
-- in the app code, but the columns need to exist first.

alter table game_scores add column if not exists approved_by text;
alter table game_score_submissions add column if not exists reviewed_by text;
