-- Etapa 8: persistência de eventos críticos de observabilidade

CREATE TABLE IF NOT EXISTS public.observability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  scope text NOT NULL,
  level text NOT NULL CHECK (level IN ('warn', 'error')),
  message text NOT NULL,
  event_kind text NOT NULL DEFAULT 'log' CHECK (event_kind IN ('log', 'alert')),
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observability_events_empresa_created_at
  ON public.observability_events (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_observability_events_scope_created_at
  ON public.observability_events (scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_observability_events_level_created_at
  ON public.observability_events (level, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_empresa_id_observability_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE(NEW.empresa_id::text, '') = '' THEN
    NEW.empresa_id := public.minha_empresa_id();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_empresa_id_observability_events ON public.observability_events;
CREATE TRIGGER trg_set_empresa_id_observability_events
BEFORE INSERT ON public.observability_events
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_observability_events();

ALTER TABLE public.observability_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "observability_events_empresa" ON public.observability_events;
CREATE POLICY "observability_events_empresa" ON public.observability_events
FOR SELECT USING (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS "observability_events_insert" ON public.observability_events;
CREATE POLICY "observability_events_insert" ON public.observability_events
FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
