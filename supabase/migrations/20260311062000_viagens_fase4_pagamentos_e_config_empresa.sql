-- Módulo Viagens (Fase 4): base de pagamentos + configurações por empresa

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS asaas_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS asaas_api_key text,
  ADD COLUMN IF NOT EXISTS asaas_webhook_secret text,
  ADD COLUMN IF NOT EXISTS asaas_api_url text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pagamento_viagem_status') THEN
    CREATE TYPE public.pagamento_viagem_status AS ENUM (
      'pendente',
      'aguardando_confirmacao',
      'aprovado',
      'recusado',
      'expirado',
      'cancelado',
      'estornado'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pagamentos_viagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  viagem_id uuid NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos_viagem(id) ON DELETE CASCADE,

  gateway text NOT NULL DEFAULT 'manual' CHECK (gateway IN ('manual', 'mercado_pago', 'asaas')),
  metodo text NOT NULL DEFAULT 'manual' CHECK (metodo IN ('pix', 'cartao', 'boleto', 'manual')),
  status public.pagamento_viagem_status NOT NULL DEFAULT 'pendente',

  valor numeric(12,2) NOT NULL DEFAULT 0,
  taxa_gateway numeric(12,2),
  valor_liquido numeric(12,2),

  provider_payment_id text,
  provider_external_reference text,
  provider_payload jsonb,

  pix_copia_cola text,
  pix_qr_code text,
  expires_at timestamptz,
  pago_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_viagem_empresa_pedido
  ON public.pagamentos_viagem(empresa_id, pedido_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pagamentos_viagem_status
  ON public.pagamentos_viagem(empresa_id, status, created_at DESC);

ALTER TABLE public.pagamentos_viagem ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pagamentos_viagem' AND policyname = 'pagamentos_viagem_empresa'
  ) THEN
    CREATE POLICY "pagamentos_viagem_empresa"
      ON public.pagamentos_viagem
      FOR SELECT
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pagamentos_viagem' AND policyname = 'pagamentos_viagem_insert'
  ) THEN
    CREATE POLICY "pagamentos_viagem_insert"
      ON public.pagamentos_viagem
      FOR INSERT
      WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pagamentos_viagem' AND policyname = 'pagamentos_viagem_update'
  ) THEN
    CREATE POLICY "pagamentos_viagem_update"
      ON public.pagamentos_viagem
      FOR UPDATE
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pagamentos_viagem' AND policyname = 'pagamentos_viagem_delete'
  ) THEN
    CREATE POLICY "pagamentos_viagem_delete"
      ON public.pagamentos_viagem
      FOR DELETE
      USING (empresa_id = public.minha_empresa_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_pagamentos_viagem()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_set_empresa_id_pagamentos_viagem ON public.pagamentos_viagem;
CREATE TRIGGER trg_set_empresa_id_pagamentos_viagem
  BEFORE INSERT ON public.pagamentos_viagem
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_pagamentos_viagem();

CREATE OR REPLACE FUNCTION public.set_updated_at_pagamentos_viagem()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_pagamentos_viagem ON public.pagamentos_viagem;
CREATE TRIGGER trg_set_updated_at_pagamentos_viagem
  BEFORE UPDATE ON public.pagamentos_viagem
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_pagamentos_viagem();

CREATE OR REPLACE FUNCTION public.public_iniciar_pagamento_viagem(
  p_pedido_id uuid,
  p_metodo text,
  p_gateway_preferido text DEFAULT NULL
)
RETURNS TABLE (
  pagamento_id uuid,
  status public.pagamento_viagem_status,
  gateway text,
  metodo text,
  valor numeric,
  pix_copia_cola text,
  pix_qr_code text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido public.pedidos_viagem;
  v_viagem public.viagens;
  v_metodo text := lower(trim(COALESCE(p_metodo, 'manual')));
  v_gateway text := lower(trim(COALESCE(p_gateway_preferido, 'manual')));
  v_pagamento_id uuid;
  v_pix text;
  v_qr text;
  v_expires timestamptz;
BEGIN
  IF v_metodo NOT IN ('pix', 'cartao', 'boleto', 'manual') THEN
    RAISE EXCEPTION 'Método de pagamento inválido';
  END IF;

  IF v_gateway NOT IN ('manual', 'mercado_pago', 'asaas') THEN
    v_gateway := 'manual';
  END IF;

  SELECT * INTO v_pedido
  FROM public.pedidos_viagem
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_pedido.status NOT IN ('pendente', 'aguardando_pagamento') THEN
    RAISE EXCEPTION 'Pedido não está elegível para pagamento';
  END IF;

  IF v_pedido.expires_at IS NOT NULL AND v_pedido.expires_at <= now() THEN
    UPDATE public.pedidos_viagem
       SET status = 'expirado',
           updated_at = now()
     WHERE id = v_pedido.id;
    RAISE EXCEPTION 'Pedido expirado';
  END IF;

  SELECT * INTO v_viagem
  FROM public.viagens
  WHERE id = v_pedido.viagem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada para o pedido';
  END IF;

  IF v_metodo = 'pix' THEN
    v_expires := COALESCE(v_pedido.expires_at, now() + interval '15 minutes');
    v_pix := 'MFBR|' || replace(v_pedido.id::text, '-', '') || '|' || to_char(now(), 'YYYYMMDDHH24MISS');
    v_qr := NULL;

    INSERT INTO public.pagamentos_viagem (
      empresa_id,
      viagem_id,
      pedido_id,
      gateway,
      metodo,
      status,
      valor,
      pix_copia_cola,
      pix_qr_code,
      expires_at,
      provider_external_reference
    ) VALUES (
      v_pedido.empresa_id,
      v_pedido.viagem_id,
      v_pedido.id,
      v_gateway,
      v_metodo,
      'aguardando_confirmacao',
      v_pedido.valor_total,
      v_pix,
      v_qr,
      v_expires,
      v_pedido.codigo_acompanhamento
    ) RETURNING id INTO v_pagamento_id;
  ELSE
    INSERT INTO public.pagamentos_viagem (
      empresa_id,
      viagem_id,
      pedido_id,
      gateway,
      metodo,
      status,
      valor,
      provider_external_reference
    ) VALUES (
      v_pedido.empresa_id,
      v_pedido.viagem_id,
      v_pedido.id,
      v_gateway,
      v_metodo,
      'pendente',
      v_pedido.valor_total,
      v_pedido.codigo_acompanhamento
    ) RETURNING id INTO v_pagamento_id;
  END IF;

  UPDATE public.pedidos_viagem
     SET status = 'aguardando_pagamento',
         updated_at = now()
   WHERE id = v_pedido.id;

  RETURN QUERY
  SELECT
    p.id,
    p.status,
    p.gateway,
    p.metodo,
    p.valor,
    p.pix_copia_cola,
    p.pix_qr_code,
    p.expires_at
  FROM public.pagamentos_viagem p
  WHERE p.id = v_pagamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_iniciar_pagamento_viagem(uuid, text, text) TO anon, authenticated;
