-- Expande configuração de gateways para suportar Asaas oficialmente

ALTER TABLE public.gateway_configs
  ADD COLUMN IF NOT EXISTS api_url text;

INSERT INTO public.gateway_configs (provider, ativo, api_url)
VALUES ('asaas', false, 'https://api.asaas.com/v3')
ON CONFLICT (provider) DO UPDATE
SET api_url = COALESCE(public.gateway_configs.api_url, EXCLUDED.api_url);

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
