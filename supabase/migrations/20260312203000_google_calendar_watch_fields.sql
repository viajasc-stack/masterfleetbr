-- Campos para sincronização automática (Google push notifications)

ALTER TABLE public.google_calendar_integrations
  ADD COLUMN IF NOT EXISTS google_watch_channel_id text,
  ADD COLUMN IF NOT EXISTS google_watch_resource_id text,
  ADD COLUMN IF NOT EXISTS google_watch_expiration timestamptz,
  ADD COLUMN IF NOT EXISTS google_watch_token text,
  ADD COLUMN IF NOT EXISTS google_sync_token text;
