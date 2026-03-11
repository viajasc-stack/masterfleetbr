-- Módulo Viagens (Fase 3): pedidos, passageiros e reserva temporária de vagas

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pedido_viagem_status') THEN
    CREATE TYPE public.pedido_viagem_status AS ENUM (
      'pendente',
      'aguardando_pagamento',
      'parcialmente_pago',
      'pago',
      'cancelado',
      'expirado',
      'estornado'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bilhete_status') THEN
    CREATE TYPE public.bilhete_status AS ENUM (
      'reservado',
      'confirmado',
      'cancelado',
      'transferido',
      'embarcado',
      'no_show'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pedidos_viagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  viagem_id uuid NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE,
  status public.pedido_viagem_status NOT NULL DEFAULT 'aguardando_pagamento',
  origem text NOT NULL DEFAULT 'publica' CHECK (origem IN ('interna', 'publica', 'whatsapp')),

  comprador_nome text NOT NULL,
  comprador_cpf text,
  comprador_telefone text,
  comprador_email text,

  quantidade_bilhetes integer NOT NULL CHECK (quantidade_bilhetes > 0),
  valor_unitario numeric(12,2) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,

  expires_at timestamptz,
  codigo_acompanhamento text NOT NULL,
  observacoes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_pedidos_viagem_codigo_acompanhamento UNIQUE (codigo_acompanhamento)
);

CREATE INDEX IF NOT EXISTS idx_pedidos_viagem_empresa_viagem
  ON public.pedidos_viagem(empresa_id, viagem_id, status);

CREATE INDEX IF NOT EXISTS idx_pedidos_viagem_expires_at
  ON public.pedidos_viagem(expires_at)
  WHERE status IN ('pendente', 'aguardando_pagamento');

CREATE TABLE IF NOT EXISTS public.passageiros_viagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  viagem_id uuid NOT NULL REFERENCES public.viagens(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos_viagem(id) ON DELETE CASCADE,

  nome text NOT NULL,
  cpf text,
  data_nascimento date,
  telefone text,
  cidade text,
  observacao text,
  responsavel_menor text,

  status public.bilhete_status NOT NULL DEFAULT 'reservado',
  qr_code_token text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passageiros_viagem_pedido
  ON public.passageiros_viagem(pedido_id);

CREATE INDEX IF NOT EXISTS idx_passageiros_viagem_viagem
  ON public.passageiros_viagem(viagem_id, status);

ALTER TABLE public.pedidos_viagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passageiros_viagem ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pedidos_viagem' AND policyname = 'pedidos_viagem_empresa'
  ) THEN
    CREATE POLICY "pedidos_viagem_empresa"
      ON public.pedidos_viagem
      FOR SELECT
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pedidos_viagem' AND policyname = 'pedidos_viagem_insert'
  ) THEN
    CREATE POLICY "pedidos_viagem_insert"
      ON public.pedidos_viagem
      FOR INSERT
      WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pedidos_viagem' AND policyname = 'pedidos_viagem_update'
  ) THEN
    CREATE POLICY "pedidos_viagem_update"
      ON public.pedidos_viagem
      FOR UPDATE
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pedidos_viagem' AND policyname = 'pedidos_viagem_delete'
  ) THEN
    CREATE POLICY "pedidos_viagem_delete"
      ON public.pedidos_viagem
      FOR DELETE
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passageiros_viagem' AND policyname = 'passageiros_viagem_empresa'
  ) THEN
    CREATE POLICY "passageiros_viagem_empresa"
      ON public.passageiros_viagem
      FOR SELECT
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passageiros_viagem' AND policyname = 'passageiros_viagem_insert'
  ) THEN
    CREATE POLICY "passageiros_viagem_insert"
      ON public.passageiros_viagem
      FOR INSERT
      WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passageiros_viagem' AND policyname = 'passageiros_viagem_update'
  ) THEN
    CREATE POLICY "passageiros_viagem_update"
      ON public.passageiros_viagem
      FOR UPDATE
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passageiros_viagem' AND policyname = 'passageiros_viagem_delete'
  ) THEN
    CREATE POLICY "passageiros_viagem_delete"
      ON public.passageiros_viagem
      FOR DELETE
      USING (empresa_id = public.minha_empresa_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_pedidos_viagem()
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

DROP TRIGGER IF EXISTS trg_set_empresa_id_pedidos_viagem ON public.pedidos_viagem;
CREATE TRIGGER trg_set_empresa_id_pedidos_viagem
  BEFORE INSERT ON public.pedidos_viagem
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_pedidos_viagem();

CREATE OR REPLACE FUNCTION public.set_empresa_id_passageiros_viagem()
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

DROP TRIGGER IF EXISTS trg_set_empresa_id_passageiros_viagem ON public.passageiros_viagem;
CREATE TRIGGER trg_set_empresa_id_passageiros_viagem
  BEFORE INSERT ON public.passageiros_viagem
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_passageiros_viagem();

CREATE OR REPLACE FUNCTION public.set_updated_at_pedidos_viagem()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_pedidos_viagem ON public.pedidos_viagem;
CREATE TRIGGER trg_set_updated_at_pedidos_viagem
  BEFORE UPDATE ON public.pedidos_viagem
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_pedidos_viagem();

CREATE OR REPLACE FUNCTION public.set_updated_at_passageiros_viagem()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_passageiros_viagem ON public.passageiros_viagem;
CREATE TRIGGER trg_set_updated_at_passageiros_viagem
  BEFORE UPDATE ON public.passageiros_viagem
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_passageiros_viagem();

CREATE OR REPLACE FUNCTION public.public_create_pedido_viagem(
  p_slug text,
  p_quantidade integer,
  p_comprador_nome text,
  p_comprador_cpf text DEFAULT NULL,
  p_comprador_telefone text DEFAULT NULL,
  p_comprador_email text DEFAULT NULL,
  p_passageiros jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  pedido_id uuid,
  codigo_acompanhamento text,
  status public.pedido_viagem_status,
  expires_at timestamptz,
  valor_total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viagem public.viagens;
  v_qtd integer := COALESCE(p_quantidade, 0);
  v_reservadas integer;
  v_disponiveis integer;
  v_valor_unitario numeric(12,2);
  v_total numeric(12,2);
  v_codigo text;
  v_expires_at timestamptz;
  v_pedido_id uuid;
  v_item jsonb;
  v_idx integer := 0;
BEGIN
  IF COALESCE(trim(p_slug), '') = '' THEN
    RAISE EXCEPTION 'Slug da viagem é obrigatório';
  END IF;

  IF v_qtd <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida de bilhetes';
  END IF;

  IF COALESCE(trim(p_comprador_nome), '') = '' THEN
    RAISE EXCEPTION 'Nome do comprador é obrigatório';
  END IF;

  SELECT *
    INTO v_viagem
  FROM public.viagens
  WHERE slug_publico = p_slug
    AND publicada_em IS NOT NULL
    AND status <> 'cancelada'::public.viagem_status
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada ou indisponível';
  END IF;

  IF v_viagem.status NOT IN ('publicada', 'vendas_abertas') THEN
    RAISE EXCEPTION 'Vendas online indisponíveis para esta viagem';
  END IF;

  IF v_viagem.prazo_final_venda_online IS NOT NULL AND now() > v_viagem.prazo_final_venda_online THEN
    RAISE EXCEPTION 'Prazo final de venda online encerrado';
  END IF;

  IF NOT v_viagem.vendas_ilimitadas AND COALESCE(v_viagem.capacidade_total, 0) > 0 THEN
    SELECT COUNT(*)
      INTO v_reservadas
    FROM public.passageiros_viagem pv
    JOIN public.pedidos_viagem p ON p.id = pv.pedido_id
    WHERE pv.viagem_id = v_viagem.id
      AND p.status IN ('pago', 'parcialmente_pago', 'pendente', 'aguardando_pagamento')
      AND (
        p.status IN ('pago', 'parcialmente_pago')
        OR p.expires_at IS NULL
        OR p.expires_at > now()
      );

    v_disponiveis := COALESCE(v_viagem.capacidade_total, 0) - COALESCE(v_reservadas, 0);

    IF v_viagem.bloquear_ao_atingir_limite AND v_disponiveis < v_qtd THEN
      RAISE EXCEPTION 'Sem vagas suficientes. Restam % vaga(s).', GREATEST(v_disponiveis, 0);
    END IF;
  END IF;

  IF jsonb_typeof(COALESCE(p_passageiros, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Passageiros deve ser um array JSON';
  END IF;

  IF jsonb_array_length(COALESCE(p_passageiros, '[]'::jsonb)) <> v_qtd THEN
    RAISE EXCEPTION 'Quantidade de passageiros deve ser igual à quantidade de bilhetes';
  END IF;

  v_valor_unitario := COALESCE(v_viagem.valor_promocional, v_viagem.valor, 0);
  v_total := v_valor_unitario * v_qtd;
  v_expires_at := now() + interval '15 minutes';
  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.pedidos_viagem (
    empresa_id,
    viagem_id,
    status,
    origem,
    comprador_nome,
    comprador_cpf,
    comprador_telefone,
    comprador_email,
    quantidade_bilhetes,
    valor_unitario,
    valor_total,
    expires_at,
    codigo_acompanhamento
  ) VALUES (
    v_viagem.empresa_id,
    v_viagem.id,
    'aguardando_pagamento',
    'publica',
    trim(p_comprador_nome),
    NULLIF(trim(COALESCE(p_comprador_cpf, '')), ''),
    NULLIF(trim(COALESCE(p_comprador_telefone, '')), ''),
    NULLIF(trim(COALESCE(p_comprador_email, '')), ''),
    v_qtd,
    v_valor_unitario,
    v_total,
    v_expires_at,
    v_codigo
  ) RETURNING id INTO v_pedido_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_passageiros)
  LOOP
    v_idx := v_idx + 1;

    IF COALESCE(trim(v_item->>'nome'), '') = '' THEN
      RAISE EXCEPTION 'Passageiro % sem nome preenchido', v_idx;
    END IF;

    INSERT INTO public.passageiros_viagem (
      empresa_id,
      viagem_id,
      pedido_id,
      nome,
      cpf,
      data_nascimento,
      telefone,
      cidade,
      observacao,
      responsavel_menor,
      status,
      qr_code_token
    ) VALUES (
      v_viagem.empresa_id,
      v_viagem.id,
      v_pedido_id,
      trim(v_item->>'nome'),
      NULLIF(trim(COALESCE(v_item->>'cpf', '')), ''),
      NULLIF(v_item->>'data_nascimento', '')::date,
      NULLIF(trim(COALESCE(v_item->>'telefone', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'cidade', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'observacao', '')), ''),
      NULLIF(trim(COALESCE(v_item->>'responsavel_menor', '')), ''),
      'reservado',
      replace(gen_random_uuid()::text, '-', '')
    );
  END LOOP;

  RETURN QUERY
  SELECT
    v_pedido_id,
    v_codigo,
    'aguardando_pagamento'::public.pedido_viagem_status,
    v_expires_at,
    v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_create_pedido_viagem(text, integer, text, text, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_viagens_expirar_pedidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
BEGIN
  UPDATE public.pedidos_viagem
     SET status = 'expirado',
         updated_at = now()
   WHERE status IN ('pendente', 'aguardando_pagamento')
     AND expires_at IS NOT NULL
     AND expires_at <= now();

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_viagens_expirar_pedidos() TO authenticated;
