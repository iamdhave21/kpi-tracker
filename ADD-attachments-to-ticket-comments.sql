alter table ticket_comments add column if not exists attachments jsonb default '[]'::jsonb;

comment on column ticket_comments.attachments is 'Screenshots/files attached to a progress note. Same shape as tickets.attachments: [{name, url, type}]';
