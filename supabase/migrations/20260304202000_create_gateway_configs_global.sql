-- Configuração global de gateways (master), sem depender de empresa_id

CREATE TABLE IF NOT EXISTS public.gateway_configs (
  provider text PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT false,
  public_key text,
  access_token text,
  user_id text,
  app_id text,
  webhook_secret text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gateway_configs_select_super_admin ON public.gateway_configs;
CREATE POLICY gateway_configs_select_super_admin
  ON public.gateway_configs
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS gateway_configs_update_super_admin ON public.gateway_configs;
CREATE POLICY gateway_configs_update_super_admin
  ON public.gateway_configs
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS gateway_configs_insert_super_admin ON public.gateway_configs;
CREATE POLICY gateway_configs_insert_super_admin
  ON public.gateway_configs
  FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.set_updated_at_gateway_configs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gateway_configs_updated_at ON public.gateway_configs;
CREATE TRIGGER trg_gateway_configs_updated_at
  BEFORE UPDATE ON public.gateway_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_gateway_configs();

INSERT INTO public.gateway_configs (provider, ativo)
VALUES ('mercado_pago', false)
ON CONFLICT (provider) DO NOTHING;
