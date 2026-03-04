-- Inventário v2
-- 1) Cadastro de fornecedores
-- 2) Entrada de estoque com múltiplos itens

CREATE TABLE IF NOT EXISTS public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fornecedores' AND policyname = 'fornecedores_empresa'
  ) THEN
    CREATE POLICY "fornecedores_empresa" ON public.fornecedores USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fornecedores' AND policyname = 'fornecedores_insert'
  ) THEN
    CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fornecedores' AND policyname = 'fornecedores_update'
  ) THEN
    CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fornecedores' AND policyname = 'fornecedores_delete'
  ) THEN
    CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE USING (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_fornecedores()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.empresa_id := public.minha_empresa_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fornecedores_empresa ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_empresa
  BEFORE INSERT ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_fornecedores();

ALTER TABLE public.entradas_estoque
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS parcelado boolean,
  ADD COLUMN IF NOT EXISTS qtd_parcelas int,
  ADD COLUMN IF NOT EXISTS intervalo_dias_parcelas int,
  ADD COLUMN IF NOT EXISTS gerar_conta_pagar boolean,
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vencimentos_parcelas jsonb;

-- Suporte a entrada multi-itens: cabeçalho da nota não precisa mais de produto/quantidade únicos
ALTER TABLE public.entradas_estoque
  ALTER COLUMN produto_id DROP NOT NULL,
  ALTER COLUMN quantidade DROP NOT NULL;

UPDATE public.entradas_estoque
SET
  forma_pagamento = COALESCE(forma_pagamento, 'boleto'),
  data_vencimento = COALESCE(data_vencimento, data_entrada, now()::date),
  parcelado = COALESCE(parcelado, false),
  qtd_parcelas = COALESCE(qtd_parcelas, 1),
  intervalo_dias_parcelas = COALESCE(intervalo_dias_parcelas, 30),
  gerar_conta_pagar = COALESCE(gerar_conta_pagar, true)
WHERE
  forma_pagamento IS NULL
  OR data_vencimento IS NULL
  OR parcelado IS NULL
  OR qtd_parcelas IS NULL
  OR intervalo_dias_parcelas IS NULL
  OR gerar_conta_pagar IS NULL;

ALTER TABLE public.entradas_estoque
  ALTER COLUMN forma_pagamento SET DEFAULT 'boleto',
  ALTER COLUMN data_vencimento SET DEFAULT now()::date,
  ALTER COLUMN parcelado SET DEFAULT false,
  ALTER COLUMN qtd_parcelas SET DEFAULT 1,
  ALTER COLUMN intervalo_dias_parcelas SET DEFAULT 30,
  ALTER COLUMN gerar_conta_pagar SET DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_entradas_fornecedor_id ON public.entradas_estoque(fornecedor_id) WHERE fornecedor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.entradas_estoque_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  entrada_id uuid NOT NULL REFERENCES public.entradas_estoque(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric,
  valor_total numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.entradas_estoque_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entradas_estoque_itens' AND policyname = 'entradas_itens_empresa'
  ) THEN
    CREATE POLICY "entradas_itens_empresa" ON public.entradas_estoque_itens USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entradas_estoque_itens' AND policyname = 'entradas_itens_insert'
  ) THEN
    CREATE POLICY "entradas_itens_insert" ON public.entradas_estoque_itens FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entradas_estoque_itens' AND policyname = 'entradas_itens_update'
  ) THEN
    CREATE POLICY "entradas_itens_update" ON public.entradas_estoque_itens FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entradas_estoque_itens' AND policyname = 'entradas_itens_delete'
  ) THEN
    CREATE POLICY "entradas_itens_delete" ON public.entradas_estoque_itens FOR DELETE USING (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_entradas_itens()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT e.empresa_id INTO v_empresa_id
  FROM public.entradas_estoque e
  WHERE e.id = NEW.entrada_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Entrada de estoque não encontrada para item.';
  END IF;

  NEW.empresa_id := v_empresa_id;
  NEW.valor_total := COALESCE(NEW.valor_total, COALESCE(NEW.valor_unitario, 0) * NEW.quantidade);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entradas_itens_empresa ON public.entradas_estoque_itens;
CREATE TRIGGER trg_entradas_itens_empresa
  BEFORE INSERT OR UPDATE ON public.entradas_estoque_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_entradas_itens();

CREATE INDEX IF NOT EXISTS idx_entradas_itens_entrada_id ON public.entradas_estoque_itens(entrada_id);

DROP FUNCTION IF EXISTS public.rpc_receber_entrada(uuid);
CREATE FUNCTION public.rpc_receber_entrada(p_entrada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entrada public.entradas_estoque;
  v_item record;
  v_has_items boolean := false;
  v_total numeric;
  v_base_venc date;
  v_parcelas int;
  v_intervalo int;
  v_valor_parcela numeric;
  v_restante numeric;
  v_valor_atual numeric;
  i int;
  v_descricao text;
  v_obs text;
  v_status text;
  v_fornecedor_nome text;
  v_vencimentos jsonb;
  v_venc date;
BEGIN
  SELECT * INTO v_entrada FROM public.entradas_estoque WHERE id = p_entrada_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;
  IF v_entrada.status <> 'pendente' THEN RAISE EXCEPTION 'Entrada já processada.'; END IF;

  FOR v_item IN
    SELECT ei.*
    FROM public.entradas_estoque_itens ei
    WHERE ei.entrada_id = p_entrada_id
    ORDER BY ei.created_at, ei.id
  LOOP
    v_has_items := true;
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
      entrada_id
    )
    VALUES (
      v_entrada.empresa_id,
      v_item.produto_id,
      v_entrada.deposito_id,
      'entrada',
      v_item.quantidade,
      'entrada_estoque',
      p_entrada_id,
      v_item.valor_unitario,
      COALESCE(v_item.valor_total, COALESCE(v_item.valor_unitario, 0) * v_item.quantidade),
      p_entrada_id
    );
  END LOOP;

  -- Compatibilidade com entradas legadas de item único
  IF NOT v_has_items THEN
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
      entrada_id
    )
    VALUES (
      v_entrada.empresa_id,
      v_entrada.produto_id,
      v_entrada.deposito_id,
      'entrada',
      v_entrada.quantidade,
      'entrada_estoque',
      p_entrada_id,
      v_entrada.valor_unitario,
      COALESCE(v_entrada.valor_total, COALESCE(v_entrada.valor_unitario, 0) * v_entrada.quantidade),
      p_entrada_id
    );
  END IF;

  SELECT COALESCE(
    NULLIF(v_entrada.valor_total, 0),
    (SELECT SUM(COALESCE(ei.valor_total, COALESCE(ei.valor_unitario, 0) * ei.quantidade))
       FROM public.entradas_estoque_itens ei
      WHERE ei.entrada_id = p_entrada_id),
    COALESCE(v_entrada.valor_unitario, 0) * COALESCE(v_entrada.quantidade, 0)
  ) INTO v_total;

  IF v_entrada.fornecedor_id IS NOT NULL THEN
    SELECT f.nome INTO v_fornecedor_nome FROM public.fornecedores f WHERE f.id = v_entrada.fornecedor_id;
  END IF;
  v_fornecedor_nome := COALESCE(v_fornecedor_nome, v_entrada.fornecedor);
  v_vencimentos := v_entrada.vencimentos_parcelas;

  IF COALESCE(v_entrada.gerar_conta_pagar, true) AND COALESCE(v_total, 0) > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contas_financeiras cf WHERE cf.entrada_estoque_id = p_entrada_id
    ) THEN
      v_base_venc := COALESCE(v_entrada.data_vencimento, v_entrada.data_entrada, now()::date);
      v_parcelas := CASE WHEN COALESCE(v_entrada.parcelado, false) THEN GREATEST(COALESCE(v_entrada.qtd_parcelas, 1), 1) ELSE 1 END;
      v_intervalo := GREATEST(COALESCE(v_entrada.intervalo_dias_parcelas, 30), 1);
      v_status := CASE WHEN v_entrada.forma_pagamento IN ('avista', 'pix') THEN 'pago' ELSE 'pendente' END;

      v_descricao := COALESCE(
        'Compra de estoque' || CASE WHEN v_fornecedor_nome IS NOT NULL THEN ' - ' || v_fornecedor_nome ELSE '' END,
        'Compra de estoque'
      );

      v_obs :=
        'Entrada de estoque ID: ' || p_entrada_id::text ||
        CASE WHEN v_entrada.nota_fiscal IS NOT NULL THEN ' | NF: ' || v_entrada.nota_fiscal ELSE '' END ||
        CASE WHEN v_fornecedor_nome IS NOT NULL THEN ' | Fornecedor: ' || v_fornecedor_nome ELSE '' END ||
        ' | Forma de pagamento: ' || COALESCE(v_entrada.forma_pagamento, 'boleto');

      v_valor_parcela := round(v_total / v_parcelas, 2);
      v_restante := v_total;

      FOR i IN 1..v_parcelas LOOP
        IF i < v_parcelas THEN
          v_valor_atual := v_valor_parcela;
          v_restante := v_restante - v_valor_parcela;
        ELSE
          v_valor_atual := v_restante;
        END IF;

        INSERT INTO public.contas_financeiras (
          empresa_id,
          descricao,
          tipo,
          valor,
          data_vencimento,
          data_pagamento,
          status,
          categoria,
          observacoes,
          entrada_estoque_id
        )
        VALUES (
          v_entrada.empresa_id,
          CASE
            WHEN v_parcelas > 1 THEN v_descricao || ' (' || i::text || '/' || v_parcelas::text || ')'
            ELSE v_descricao
          END,
          'pagar',
          v_valor_atual,
          COALESCE(
            (
              CASE
                WHEN jsonb_typeof(v_vencimentos) = 'array'
                 AND jsonb_array_length(v_vencimentos) >= i
                 AND NULLIF(v_vencimentos ->> (i - 1), '') IS NOT NULL
                THEN (v_vencimentos ->> (i - 1))::date
                ELSE NULL
              END
            ),
            v_base_venc + ((i - 1) * v_intervalo)
          ),
          CASE WHEN v_status = 'pago' THEN COALESCE(v_entrada.data_entrada, now()::date) ELSE NULL END,
          v_status,
          'Fornecedores',
          v_obs,
          p_entrada_id
        );
      END LOOP;
    END IF;
  END IF;

  UPDATE public.entradas_estoque SET status = 'recebido' WHERE id = p_entrada_id;
END;
$$;

DROP FUNCTION IF EXISTS public.rpc_cancelar_entrada(uuid);
CREATE FUNCTION public.rpc_cancelar_entrada(p_entrada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entrada public.entradas_estoque;
  v_item record;
  v_has_items boolean := false;
BEGIN
  SELECT * INTO v_entrada FROM public.entradas_estoque WHERE id = p_entrada_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;

  IF v_entrada.status = 'recebido' THEN
    FOR v_item IN
      SELECT ei.*
      FROM public.entradas_estoque_itens ei
      WHERE ei.entrada_id = p_entrada_id
      ORDER BY ei.created_at, ei.id
    LOOP
      v_has_items := true;
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
        entrada_id
      )
      VALUES (
        v_entrada.empresa_id,
        v_item.produto_id,
        v_entrada.deposito_id,
        'saida',
        v_item.quantidade,
        'cancelamento_entrada',
        p_entrada_id,
        v_item.valor_unitario,
        COALESCE(v_item.valor_total, COALESCE(v_item.valor_unitario, 0) * v_item.quantidade),
        p_entrada_id
      );
    END LOOP;

    IF NOT v_has_items THEN
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
        entrada_id
      )
      VALUES (
        v_entrada.empresa_id,
        v_entrada.produto_id,
        v_entrada.deposito_id,
        'saida',
        v_entrada.quantidade,
        'cancelamento_entrada',
        p_entrada_id,
        v_entrada.valor_unitario,
        COALESCE(v_entrada.valor_total, COALESCE(v_entrada.valor_unitario, 0) * v_entrada.quantidade),
        p_entrada_id
      );
    END IF;

    UPDATE public.contas_financeiras
    SET status = 'cancelado'
    WHERE entrada_estoque_id = p_entrada_id
      AND status = 'pendente';
  END IF;

  UPDATE public.entradas_estoque SET status = 'cancelado' WHERE id = p_entrada_id;
END;
$$;
