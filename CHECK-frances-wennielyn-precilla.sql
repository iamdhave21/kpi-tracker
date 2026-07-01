-- Check current state of Frances and Wennielyn's login records
select username, role, active from app_users
where username ilike '%frances%' or username ilike '%wennielyn%'
order by username;

-- Also check for any duplicate/stale entries
select username, role, active from app_users
where username ilike '%precilla%'
order by username;
