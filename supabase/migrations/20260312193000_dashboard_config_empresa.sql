-- Configurações de visibilidade do dashboard por empresa

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS dashboard_config jsonb NOT NULL DEFAULT '{}'::jsonb;
