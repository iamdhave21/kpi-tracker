-- Ops Dashboard card order, saved per person so it follows them across
-- devices (same approach as app_users.favorite_views). Nullable: no value
-- means "default order". Run once in the Supabase SQL Editor.
alter table public.app_users add column if not exists ops_card_order jsonb;
