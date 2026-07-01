-- ============================================================
-- CATCH-UP LOG: All features shipped but not yet in Matrix
-- Run this once to bring Matrix fully up to date
-- ============================================================

insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values

-- Operating Cadence compliance graph upgrade (separate per-frequency rates + historical line graph)
(
  'Feature',
  'Operating Cadence compliance graph: separate Daily/Weekly/Monthly rates + switchable historical graph',
  'Upgraded the CadenceCompliance component from a single combined rate to three separate percentages (Daily %, Weekly %, Monthly %) for the current period, shown side-by-side per Team Lead. Added a switchable historical line graph below (Daily = last 14 days, Weekly = last 8 weeks, Monthly = last 6 months) so dips and missed periods are visible at a glance. Clicking a Team Lead shows their history. Green dashed reference line at 80% target. Rate calculation factored into a reusable CadenceCompliance component for planned future Team Lead Scorecard integration.',
  'Done',
  'Medium',
  'system',
  now()
),

-- Profile photo consolidation
(
  'Feature',
  'Profile photo/name consolidated to sidebar top -- removed from header and Announcements',
  'Photo + name + role were duplicated in 3 places (top-right header, top of Announcements page, bottom of sidebar). Consolidated to one permanent location: the top of the sidebar, above Favorites, visible on every page. Photo is now click-to-upload/change directly from the sidebar. Header replaced with a clean Log Out button only. Announcements page no longer shows the redundant profile card.',
  'Done',
  'Low',
  'system',
  now()
),

-- Sidebar text contrast fix
(
  'Issue',
  'Sidebar sub-item text was too light (gray-600) -- darkened to near-black for readability',
  'Inactive nav item labels were text-gray-600, hard to read especially at smaller sizes. Changed to text-gray-900 for much stronger contrast. Active items (white on blue) and section headers (white on dark blue) were already fine and unchanged.',
  'Done',
  'Low',
  'system',
  now()
),

-- Frances account fix
(
  'Issue',
  'Frances Miranda showing as Agent despite Manager role -- account was Inactive',
  'Frances had a correct Manager (admin) role in app_users but the active field was false, causing the app to treat her as a default viewer. Fixed by setting active = true. She also needed to log out and back in to clear the stale cached session.',
  'Done',
  'High',
  'system',
  now()
),

-- Email cleanup
(
  'Issue',
  'Stale wrong-email app_users entries cleaned up (recilla@, wennielyn@)',
  'Two malformed username entries existed: recilla@ab-businesssupport.com (missing leading p) and wennielyn@ab-businesssupport.com (missing .pungasi). Both deleted. Correct entries (precilla.cornel@... and wennielyn.pungasi@...) were already present and unaffected.',
  'Done',
  'Low',
  'system',
  now()
);
