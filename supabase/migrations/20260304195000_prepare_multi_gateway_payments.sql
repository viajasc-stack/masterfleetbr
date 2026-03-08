-- Base para suportar múltiplos provedores de pagamento por empresa
-- (Mercado Pago agora; outros gateways no futuro)

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_external_reference text,
  ADD COLUMN IF NOT EXISTS provider_payload jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'faturas_payment_provider_check'
  ) THEN
    ALTER TABLE public.faturas
      ADD CONSTRAINT faturas_payment_provider_check
      CHECK (
        payment_provider IS NULL
        OR payment_provider IN ('mercado_pago', 'asaas', 'stripe', 'manual')
      );
  END IF;
END $$;

ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider text;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_empresa_provider
  ON public.webhook_logs(empresa_id, provider, created_at DESC);
