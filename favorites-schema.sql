-- ============================================================
-- Sidebar Favorites: drag-and-drop personal shortcuts
-- Persisted per-account (not device-specific), purely additive --
-- does not change or remove anything from the existing full sidebar.
-- ============================================================

alter table app_users add column if not exists favorite_views jsonb default '[]'::jsonb;
