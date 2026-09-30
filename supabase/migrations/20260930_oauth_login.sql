-- ─────────────────────────────────────────────────────────────────────────
-- Switch login from pasted Builder API keys to HelloMinds OAuth
-- (@animocabrands/minds-connect, OAuth 2.1 + PKCE).
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────

-- OAuth-only users have no Builder key.
alter table ram_users alter column builder_key drop not null;

-- The OAuth session. Tokens are AES-256-GCM encrypted by the app, same as
-- builder_key was. The refresh token ROTATES on every use, so exactly one
-- process may refresh at a time — oauth_refresh_lock_until is that lease.
alter table ram_users add column if not exists oauth_user_id           text;
alter table ram_users add column if not exists oauth_access_token      text;
alter table ram_users add column if not exists oauth_refresh_token     text;
alter table ram_users add column if not exists oauth_expires_at        timestamptz;
alter table ram_users add column if not exists oauth_scope             text;
alter table ram_users add column if not exists oauth_refresh_lock_until timestamptz;
alter table ram_users add column if not exists oauth_connected_at      timestamptz;

-- `sub` from the access token. Unique so one HelloMinds account = one row.
create unique index if not exists ram_users_oauth_user_id_key
  on ram_users (oauth_user_id) where oauth_user_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- LATER, not now: once every active user has reconnected with OAuth and it
-- has been verified in production, drop the stored Builder keys. Until then
-- they are simply unused — the app no longer reads them.
--
--   update ram_users set builder_key = null;
--   alter table ram_users drop column builder_key;
-- ─────────────────────────────────────────────────────────────────────────
