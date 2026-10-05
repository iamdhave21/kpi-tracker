-- BCP is now organised by five departments: Operations, Payroll,
-- Recruitment, Client Management, IT. Run these in order in the Supabase
-- SQL Editor.

-- 1) See what's there now (tasks under an old label show as "Unassigned"
--    in the app until moved):
select category, count(*) from bcp_tasks group by category order by 2 desc;

-- 2) 'IT/Systems' is the same department as 'IT' -- safe to rename:
update bcp_tasks set category = 'IT' where category = 'IT/Systems';
