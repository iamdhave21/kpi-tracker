insert into dev_matrix (category, title, description, status, priority, created_by, created_at) values
(
  'Feature',
  'Performance Dashboard — Compliance score auto-calc + manual override',
  'Compliance (5% of Overall KPI score) is now auto-calculated as (coaching acks + announcement acks acknowledged) / (total requiring ack) for the employee''s month, shown in both KPI Entry and Edit Score modal with a breakdown (e.g. "3/5 acknowledged — 2/2 coaching, 1/3 announcements"). Super Admin/Admin can override the auto value manually in either form -- important during July rollout while adoption of coaching/announcement acks is still ramping up and auto data may be 0 or missing. Manual overrides are logged to audit_log same as other fields. No schema change required (compliance_score column already existed on kpi_records).',
  'Done',
  'Medium',
  'system',
  now()
);
