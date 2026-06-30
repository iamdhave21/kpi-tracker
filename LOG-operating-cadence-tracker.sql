insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Feature',
  'Operating Cadence: turn into a real tracker with checkboxes, notes, and compliance view',
  'Operating Cadence is currently a static, read-only reference page (daily/weekly/monthly checklist items shown as plain text bullets, nothing interactive). Requested: make each item an actual checkbox a Team Lead can check off per day/week/month, with a notes field to record what was actually accomplished. Also wants a compliance view showing who has/hasn''t completed their cadence items, to spot gaps. This is a real feature build (new database table to track completions per Team Lead per period, not a quick tweak to the existing static component) -- needs its own dedicated session.',
  'Open',
  'Medium',
  'system',
  now()
);
