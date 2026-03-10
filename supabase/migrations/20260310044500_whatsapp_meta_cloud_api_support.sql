-- Suporte a provider oficial Meta WhatsApp Cloud API

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'whatsapp_configs_provider_check'
      AND conrelid = 'public.whatsapp_configs'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_configs
      DROP CONSTRAINT whatsapp_configs_provider_check;
  END IF;
END $$;

ALTER TABLE public.whatsapp_configs
  ADD CONSTRAINT whatsapp_configs_provider_check
  CHECK (provider IN ('custom_webhook', 'zapi', 'twilio', '360dialog', 'evolution', 'meta_cloud_api'));

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
