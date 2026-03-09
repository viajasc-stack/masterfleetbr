-- Módulo de abastecimentos manuais (interno/externo)

ALTER TABLE public.abastecimentos
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposito_id uuid REFERENCES public.depositos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conta_financeira_id uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS movimento_estoque_id uuid REFERENCES public.movimentos_estoque(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_abastecimento timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS media_km_l numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'abastecimentos_forma_pagamento_check'
  ) THEN
    ALTER TABLE public.abastecimentos
      ADD CONSTRAINT abastecimentos_forma_pagamento_check
      CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('avista', 'pix', 'boleto', 'cartao', 'dinheiro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_abastecimentos_empresa_data ON public.abastecimentos(empresa_id, data_abastecimento DESC);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_veiculo_data ON public.abastecimentos(veiculo_id, data_abastecimento DESC);

CREATE OR REPLACE FUNCTION public.registrar_abastecimento_manual(
  p_veiculo_id uuid,
  p_origem text,
  p_km numeric,
  p_litros numeric,
  p_valor numeric DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_data_abastecimento timestamptz DEFAULT now(),
  p_produto_id uuid DEFAULT NULL,
  p_deposito_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_abastecimento_id uuid;
  v_conta_id uuid;
  v_movimento_id uuid;
  v_prev_km numeric;
  v_media numeric;
  v_preco_custo numeric;
  v_placa text;
  v_saldo numeric;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_origem NOT IN ('interna', 'externa') THEN
    RAISE EXCEPTION 'origem_invalida';
  END IF;

  IF COALESCE(p_litros, 0) <= 0 THEN
    RAISE EXCEPTION 'litros_invalidos';
  END IF;

  IF COALESCE(p_km, 0) <= 0 THEN
    RAISE EXCEPTION 'km_invalido';
  END IF;

  SELECT v.placa
    INTO v_placa
    FROM public.veiculos v
   WHERE v.id = p_veiculo_id
     AND v.empresa_id = v_empresa_id
   LIMIT 1;

  IF v_placa IS NULL THEN
    RAISE EXCEPTION 'veiculo_not_found';
  END IF;

  IF p_origem = 'externa' THEN
    IF COALESCE(p_valor, 0) <= 0 THEN
      RAISE EXCEPTION 'valor_obrigatorio_externo';
    END IF;

    IF COALESCE(p_forma_pagamento, '') NOT IN ('avista', 'pix', 'boleto', 'cartao', 'dinheiro') THEN
      RAISE EXCEPTION 'forma_pagamento_invalida';
    END IF;
  ELSE
    IF p_produto_id IS NULL OR p_deposito_id IS NULL THEN
      RAISE EXCEPTION 'produto_deposito_obrigatorio_interno';
    END IF;

    SELECT p.preco_custo
      INTO v_preco_custo
      FROM public.produtos p
     WHERE p.id = p_produto_id
       AND p.empresa_id = v_empresa_id
       AND p.ativo = true
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'produto_not_found';
    END IF;

    SELECT COALESCE(se.quantidade, 0)
      INTO v_saldo
      FROM public.saldos_estoque se
     WHERE se.produto_id = p_produto_id
       AND se.deposito_id = p_deposito_id
       AND se.empresa_id = v_empresa_id
     LIMIT 1;

    IF COALESCE(v_saldo, 0) < p_litros THEN
      RAISE EXCEPTION 'saldo_insuficiente_estoque';
    END IF;
  END IF;

  INSERT INTO public.abastecimentos (
    empresa_id,
    veiculo_id,
    tipo,
    origem_abastecimento,
    km,
    litros,
    valor,
    cupom_url,
    forma_pagamento,
    produto_id,
    deposito_id,
    observacao,
    status,
    data_abastecimento
  )
  VALUES (
    v_empresa_id,
    p_veiculo_id,
    'registro',
    CASE WHEN p_origem = 'interna' THEN 'empresa' ELSE 'posto' END,
    p_km,
    p_litros,
    CASE WHEN p_origem = 'externa' THEN p_valor ELSE NULL END,
    CASE WHEN p_origem = 'externa' THEN 'manual://cadastro-painel' ELSE NULL END,
    CASE WHEN p_origem = 'externa' THEN p_forma_pagamento ELSE NULL END,
    CASE WHEN p_origem = 'interna' THEN p_produto_id ELSE NULL END,
    CASE WHEN p_origem = 'interna' THEN p_deposito_id ELSE NULL END,
    NULLIF(btrim(COALESCE(p_observacao, '')), ''),
    'concluido',
    COALESCE(p_data_abastecimento, now())
  )
  RETURNING id INTO v_abastecimento_id;

  IF p_origem = 'externa' THEN
    INSERT INTO public.contas_financeiras (
      empresa_id,
      descricao,
      tipo,
      valor,
      data_vencimento,
      data_pagamento,
      status,
      categoria,
      observacoes
    )
    VALUES (
      v_empresa_id,
      'Abastecimento externo - ' || v_placa,
      'pagar',
      p_valor,
      COALESCE(p_data_abastecimento, now())::date,
      CASE WHEN p_forma_pagamento IN ('avista', 'pix', 'cartao', 'dinheiro') THEN COALESCE(p_data_abastecimento, now())::date ELSE NULL END,
      CASE WHEN p_forma_pagamento IN ('avista', 'pix', 'cartao', 'dinheiro') THEN 'pago' ELSE 'pendente' END,
      'Abastecimento',
      'Abastecimento externo | Veículo: ' || v_placa || ' | Litros: ' || p_litros::text || ' | KM: ' || p_km::text || ' | Forma: ' || COALESCE(p_forma_pagamento, '-')
    )
    RETURNING id INTO v_conta_id;

    UPDATE public.abastecimentos
       SET conta_financeira_id = v_conta_id
     WHERE id = v_abastecimento_id;
  ELSE
    INSERT INTO public.movimentos_estoque (
      empresa_id,
      produto_id,
      deposito_id,
      tipo,
      quantidade,
      origem,
      referencia_id,
      valor_unitario,
      valor_total,
      veiculo_id
    )
    VALUES (
      v_empresa_id,
      p_produto_id,
      p_deposito_id,
      'saida',
      p_litros,
      'abastecimento_interno',
      v_abastecimento_id,
      v_preco_custo,
      COALESCE(v_preco_custo, 0) * p_litros,
      p_veiculo_id
    )
    RETURNING id INTO v_movimento_id;

    UPDATE public.abastecimentos
       SET movimento_estoque_id = v_movimento_id
     WHERE id = v_abastecimento_id;
  END IF;

  SELECT a.km
    INTO v_prev_km
    FROM public.abastecimentos a
   WHERE a.empresa_id = v_empresa_id
     AND a.veiculo_id = p_veiculo_id
     AND a.id <> v_abastecimento_id
     AND a.km IS NOT NULL
     AND a.status <> 'cancelado'
   ORDER BY a.data_abastecimento DESC, a.created_at DESC
   LIMIT 1;

  IF v_prev_km IS NOT NULL AND p_km > v_prev_km THEN
    v_media := ROUND(((p_km - v_prev_km) / NULLIF(p_litros, 0))::numeric, 2);
  ELSE
    v_media := NULL;
  END IF;

  UPDATE public.abastecimentos
     SET media_km_l = v_media
   WHERE id = v_abastecimento_id;

  RETURN v_abastecimento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_abastecimentos(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_limite int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  veiculo_id uuid,
  placa text,
  km numeric,
  litros numeric,
  valor numeric,
  tipo text,
  data_abastecimento timestamptz,
  media_km_l numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.veiculo_id,
    v.placa,
    a.km,
    a.litros,
    a.valor,
    CASE WHEN a.origem_abastecimento = 'empresa' THEN 'interna' ELSE 'externa' END AS tipo,
    a.data_abastecimento,
    a.media_km_l
  FROM public.abastecimentos a
  LEFT JOIN public.veiculos v ON v.id = a.veiculo_id
  WHERE a.empresa_id = v_empresa_id
    AND (p_data_inicio IS NULL OR a.data_abastecimento::date >= p_data_inicio)
    AND (p_data_fim IS NULL OR a.data_abastecimento::date <= p_data_fim)
    AND a.tipo = 'registro'
  ORDER BY a.data_abastecimento DESC, a.created_at DESC
  LIMIT GREATEST(COALESCE(p_limite, 200), 1);
END;
$$;
