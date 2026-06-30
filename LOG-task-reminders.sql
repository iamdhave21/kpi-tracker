insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Feature',
  'Daily email reminders for tasks due today and overdue',
  'New Vercel Cron Job (vercel.json, runs daily 1am UTC / 9am PH time) sends reminder emails: due-today tasks get a same-day reminder, overdue tasks get a repeating daily reminder until marked done. New route /api/cron/task-reminders, protected by CRON_SECRET bearer token. Requires CRON_SECRET env var to be set in Vercel.',
  'Done',
  'Medium',
  'system',
  now()
);
