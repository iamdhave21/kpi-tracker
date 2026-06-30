insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Feature',
  'Role-based access control for Employees, Teams, Observations',
  'Page-by-page permission audit found Agents and Team Leads had full edit access to Employees and Teams with zero gating -- anyone could add, edit, or delete any record. Fixed: Employees and Teams are now view-only for Agent/Team Lead, edit reserved for Manager+. Observations properly scoped: Team Lead sees only their own team''s notes (real query filter, not just hidden rows), Manager sees everyone, and Agents now have a new "My Observations" read-only page showing notes about themselves (previously fully blocked, which was wrong per spec). Performance dashboards audited -- already correct, no changes needed.',
  'Done',
  'High',
  'system',
  now()
),
(
  'Issue',
  'Permission checks are UI-level only, not enforced at the database',
  'All role-based access control built so far (Employees, Teams, Observations, BCP, Tickets, HRIS, etc.) works by hiding buttons/controls in the React frontend based on the user''s role. This matches the existing pattern across the whole app, but it is not true security -- a technically savvy person could open the browser console and call Supabase directly using the public anon key, bypassing every UI-level check entirely. Proper fix requires Supabase Row Level Security (RLS) policies written per-table that check the requesting user''s role/team membership at the database level, so access is enforced no matter how the request is made (app UI, browser console, or an external script). This is a larger, more involved piece of work than what has been built so far -- flagged for follow-up, not yet started.',
  'Open',
  'High',
  'system',
  now()
);
