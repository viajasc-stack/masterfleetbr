-- Fase 2.1 Inventário + Financeiro
-- Geração automática de contas a pagar a partir de entradas de estoque.

ALTER TABLE public.entradas_estoque
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS parcelado boolean,
  ADD COLUMN IF NOT EXISTS qtd_parcelas int,
  ADD COLUMN IF NOT EXISTS intervalo_dias_parcelas int,
  ADD COLUMN IF NOT EXISTS gerar_conta_pagar boolean;

UPDATE public.entradas_estoque
SET
  forma_pagamento = COALESCE(forma_pagamento, 'boleto'),
  parcelado = COALESCE(parcelado, false),
  qtd_parcelas = COALESCE(qtd_parcelas, 1),
  intervalo_dias_parcelas = COALESCE(intervalo_dias_parcelas, 30),
  gerar_conta_pagar = COALESCE(gerar_conta_pagar, true);

ALTER TABLE public.entradas_estoque
  ALTER COLUMN forma_pagamento SET DEFAULT 'boleto',
  ALTER COLUMN forma_pagamento SET NOT NULL,
  ALTER COLUMN parcelado SET DEFAULT false,
  ALTER COLUMN parcelado SET NOT NULL,
  ALTER COLUMN qtd_parcelas SET DEFAULT 1,
  ALTER COLUMN qtd_parcelas SET NOT NULL,
  ALTER COLUMN intervalo_dias_parcelas SET DEFAULT 30,
  ALTER COLUMN intervalo_dias_parcelas SET NOT NULL,
  ALTER COLUMN gerar_conta_pagar SET DEFAULT true,
  ALTER COLUMN gerar_conta_pagar SET NOT NULL;

ALTER TABLE public.entradas_estoque
  DROP CONSTRAINT IF EXISTS entradas_forma_pagamento_check;

ALTER TABLE public.entradas_estoque
  ADD CONSTRAINT entradas_forma_pagamento_check
  CHECK (forma_pagamento IN ('avista', 'boleto', 'cartao', 'pix'));

ALTER TABLE public.entradas_estoque
  DROP CONSTRAINT IF EXISTS entradas_qtd_parcelas_check;

ALTER TABLE public.entradas_estoque
  ADD CONSTRAINT entradas_qtd_parcelas_check
  CHECK (qtd_parcelas >= 1);

ALTER TABLE public.entradas_estoque
  DROP CONSTRAINT IF EXISTS entradas_intervalo_dias_parcelas_check;

ALTER TABLE public.entradas_estoque
  ADD CONSTRAINT entradas_intervalo_dias_parcelas_check
  CHECK (intervalo_dias_parcelas >= 1);

ALTER TABLE public.contas_financeiras
  ADD COLUMN IF NOT EXISTS entrada_estoque_id uuid REFERENCES public.entradas_estoque(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_entrada_estoque_id ON public.contas_financeiras(entrada_estoque_id) WHERE entrada_estoque_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_receber_entrada(entrada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entrada public.entradas_estoque;
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
BEGIN
  SELECT * INTO v_entrada FROM public.entradas_estoque WHERE id = entrada_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;
  IF v_entrada.status <> 'pendente' THEN RAISE EXCEPTION 'Entrada já processada.'; END IF;

  v_total := COALESCE(v_entrada.valor_total, COALESCE(v_entrada.valor_unitario, 0) * v_entrada.quantidade);

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
    entrada_id,
    v_entrada.valor_unitario,
    v_total,
    entrada_id
  );

  IF COALESCE(v_entrada.gerar_conta_pagar, true) AND v_total > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.contas_financeiras cf WHERE cf.entrada_estoque_id = entrada_id
    ) THEN
      v_base_venc := COALESCE(v_entrada.data_vencimento, v_entrada.data_entrada, now()::date);
      v_parcelas := CASE WHEN COALESCE(v_entrada.parcelado, false) THEN GREATEST(COALESCE(v_entrada.qtd_parcelas, 1), 1) ELSE 1 END;
      v_intervalo := GREATEST(COALESCE(v_entrada.intervalo_dias_parcelas, 30), 1);
      v_status := CASE WHEN v_entrada.forma_pagamento = 'avista' THEN 'pago' ELSE 'pendente' END;

      v_descricao := COALESCE(
        'Compra de estoque' || CASE WHEN v_entrada.fornecedor IS NOT NULL THEN ' - ' || v_entrada.fornecedor ELSE '' END,
        'Compra de estoque'
      );

      v_obs :=
        'Entrada de estoque ID: ' || entrada_id::text ||
        CASE WHEN v_entrada.nota_fiscal IS NOT NULL THEN ' | NF: ' || v_entrada.nota_fiscal ELSE '' END ||
        CASE WHEN v_entrada.fornecedor IS NOT NULL THEN ' | Fornecedor: ' || v_entrada.fornecedor ELSE '' END ||
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
          v_base_venc + ((i - 1) * v_intervalo),
          CASE WHEN v_status = 'pago' THEN COALESCE(v_entrada.data_entrada, now()::date) ELSE NULL END,
          v_status,
          'Fornecedores',
          v_obs,
          entrada_id
        );
      END LOOP;
    END IF;
  END IF;

  UPDATE public.entradas_estoque SET status = 'recebido' WHERE id = entrada_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_cancelar_entrada(entrada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_entrada public.entradas_estoque;
BEGIN
  SELECT * INTO v_entrada FROM public.entradas_estoque WHERE id = entrada_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;
  IF v_entrada.status = 'recebido' THEN
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
      entrada_id,
      v_entrada.valor_unitario,
      COALESCE(v_entrada.valor_total, COALESCE(v_entrada.valor_unitario, 0) * v_entrada.quantidade),
      entrada_id
    );

    UPDATE public.contas_financeiras
    SET status = 'cancelado'
    WHERE entrada_estoque_id = entrada_id
      AND status = 'pendente';
  END IF;

  UPDATE public.entradas_estoque SET status = 'cancelado' WHERE id = entrada_id;
END;
$$;
