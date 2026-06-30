insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Feature',
  'Sidebar: Collapse All button',
  'Add a single button that collapses every sidebar section at once (Home, Operations, Directory, etc.) instead of requiring each section header to be clicked individually.',
  'Open',
  'Low',
  'system',
  now()
),
(
  'Feature',
  'Sidebar: Favorites with drag-and-drop, without changing the full nav structure',
  'Allow users to pin/favorite specific nav items (e.g. Tickets, Employees) into a personal favorites area that they can reorder by dragging. Must not alter or remove anything from the existing full sidebar underneath -- favorites is an additive, personal shortcut layer.',
  'Open',
  'Medium',
  'system',
  now()
),
(
  'Feature',
  'Sidebar: bold sub-category text + colored badges',
  'Make individual nav item labels (Tickets, BCP, Employees, etc.) bold for better readability, and add colored badges per item -- needs a follow-up conversation on whether badges mean notification/counts (like the existing pending coaching count) or a simpler color-coded tag per section for visual grouping.',
  'Open',
  'Low',
  'system',
  now()
),
(
  'Feature',
  'Coaching sessions: save as draft',
  'Team Leads should be able to start filling out a coaching log, save it as a draft without submitting, and return later to finish before the actual session takes place. Currently coaching logs only support immediate full submission.',
  'Open',
  'Medium',
  'system',
  now()
);
