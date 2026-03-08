-- Configurações do Mercado Pago por empresa

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS mercado_pago_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mp_public_key text,
  ADD COLUMN IF NOT EXISTS mp_access_token text,
  ADD COLUMN IF NOT EXISTS mp_user_id text,
  ADD COLUMN IF NOT EXISTS mp_app_id text,
  ADD COLUMN IF NOT EXISTS mp_webhook_secret text;
