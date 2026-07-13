-- Step 1: find every trace of the stale email across the tables most
-- likely to have it. Run this first and review the results before deleting
-- anything.

select 'app_users' as source, id::text, username, email, role::text as detail from app_users where email = 'precilla@ab-businesssupport.com' or username = 'precilla'
union all
select 'employees', id::text, name, email, designation from employees where email = 'precilla@ab-businesssupport.com'
union all
select 'coaching_logs', id::text, employee_name, employee_email, type from coaching_logs where employee_email = 'precilla@ab-businesssupport.com'
union all
select 'tasks', id::text, title, assigned_to, assigned_by from tasks where assigned_to = 'precilla@ab-businesssupport.com' or assigned_by = 'precilla@ab-businesssupport.com'
union all
select 'announcement_acknowledgements', id::text, user_email, user_email, '' from announcement_acknowledgements where user_email = 'precilla@ab-businesssupport.com'
union all
select 'game_score_submissions', id::text, user_name, user_email, status from game_score_submissions where user_email = 'precilla@ab-businesssupport.com'
union all
select 'game_scores', id::text, user_name, user_email, '' from game_scores where user_email = 'precilla@ab-businesssupport.com';

-- Step 2: once you've reviewed the results above and confirmed it's safe,
-- delete the orphaned app_users record specifically (this is the one
-- causing the email bounce -- her real login is precilla.cornel@...).
-- Uncomment and run:

-- delete from app_users where email = 'precilla@ab-businesssupport.com' or username = 'precilla';

-- If Step 1 also found rows in coaching_logs, tasks, announcement_acks,
-- or game tables using the old email, those are historical records tied
-- to an email that no longer has a real login -- let me know what turns
-- up and I'll help you decide whether to update or leave them (deleting
-- historical audit-adjacent data isn't something to do casually).
