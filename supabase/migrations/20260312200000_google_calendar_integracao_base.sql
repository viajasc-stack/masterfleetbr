-- Integração Google Calendar por empresa (com isolamento multi-tenant)

CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  sync_direction text NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'google_to_masterfleet', 'masterfleet_to_google')),
  calendar_id text NOT NULL DEFAULT 'primary',
  google_connected_email text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  oauth_state text,
  oauth_state_expires_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id)
);

ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_calendar_integrations_empresa_select ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_empresa_select
  ON public.google_calendar_integrations
  FOR SELECT
  USING (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS google_calendar_integrations_empresa_insert ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_empresa_insert
  ON public.google_calendar_integrations
  FOR INSERT
  WITH CHECK (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS google_calendar_integrations_empresa_update ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_empresa_update
  ON public.google_calendar_integrations
  FOR UPDATE
  USING (empresa_id = public.minha_empresa_id())
  WITH CHECK (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS google_calendar_integrations_empresa_delete ON public.google_calendar_integrations;
CREATE POLICY google_calendar_integrations_empresa_delete
  ON public.google_calendar_integrations
  FOR DELETE
  USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_updated_at_google_calendar_integrations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_calendar_integrations_updated_at ON public.google_calendar_integrations;
CREATE TRIGGER trg_google_calendar_integrations_updated_at
BEFORE UPDATE ON public.google_calendar_integrations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_google_calendar_integrations();

ALTER TABLE public.agenda_eventos
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_etag text,
  ADD COLUMN IF NOT EXISTS google_last_synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_eventos_empresa_google_event_id_key'
      AND conrelid = 'public.agenda_eventos'::regclass
  ) THEN
    ALTER TABLE public.agenda_eventos
      ADD CONSTRAINT agenda_eventos_empresa_google_event_id_key UNIQUE (empresa_id, google_event_id);
  END IF;
END;
$$;
