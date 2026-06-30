insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Feature',
  'Permission fixes for Links, Resources, Employee Referral, Employee Records',
  'Second batch of the page-by-page permission audit. Links and Resources: add/delete was incorrectly available to Team Lead, spec says Manager-only -- fixed. Employee Referral: previously every submission was visible to everyone regardless of submitter (candidate names, resume links, who referred them all fully exposed company-wide); now Agent/Team Lead only see their own submissions and status, Manager+ see everyone and can Export to Excel (new feature, Manager-only). Employee Records: now fully blocked for Agent/Team Lead at the view level with a clean "Access Restricted" message, matching the existing pattern used by KPI Entry/Observations. BCP and Tickets audited and already matched spec exactly -- no changes needed.',
  'Done',
  'High',
  'system',
  now()
);
