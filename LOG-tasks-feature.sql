insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Feature',
  'Tasks: Manager/Team Lead assigns tasks to subordinates with deadlines',
  'New standalone Tasks tab under Operations, separate from Tickets. Manager/Team Lead assign a task (title, description, assignee, due date) to anyone with a work email on file. Simple done/not-done checkbox status. Manager/Team Lead see all tasks; Agents only see tasks assigned to them. Sidebar badge shows pending count. Email notification sent to assignee on creation via /api/notify/task-assigned.',
  'Done',
  'Medium',
  'system',
  now()
);
