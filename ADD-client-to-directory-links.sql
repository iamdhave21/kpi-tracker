alter table directory_links add column if not exists client text;

comment on column directory_links.client is 'Client the link supports: EMMA, AB BSS, Harlan + Holden, or NULL for general/company-wide links.';
