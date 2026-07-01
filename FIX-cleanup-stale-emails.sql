-- ============================================================
-- Email cleanup - July 1 2026
-- Remove stale/wrong username entries from app_users
-- ============================================================

-- Delete the wrong Precilla entry (missing the 'p' at the start)
delete from app_users where username = 'recilla@ab-businesssupport.com';

-- Delete the wrong Wennielyn entry (missing .pungasi)
delete from app_users where username = 'wennielyn@ab-businesssupport.com';

-- Verify final state of all accounts
select username, role, active
from app_users
order by created_at;
