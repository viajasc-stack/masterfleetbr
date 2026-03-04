-- Fase 2 Inventário
-- Enriquecer movimentos de estoque com custo e vínculos operacionais.

ALTER TABLE public.movimentos_estoque
  ADD COLUMN IF NOT EXISTS valor_unitario numeric,
  ADD COLUMN IF NOT EXISTS valor_total numeric,
  ADD COLUMN IF NOT EXISTS entrada_id uuid REFERENCES public.entradas_estoque(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manutencao_id uuid REFERENCES public.manutencoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimentos_empresa_created ON public.movimentos_estoque(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimentos_entrada_id ON public.movimentos_estoque(entrada_id) WHERE entrada_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimentos_veiculo_id ON public.movimentos_estoque(veiculo_id) WHERE veiculo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimentos_os_id ON public.movimentos_estoque(ordem_servico_id) WHERE ordem_servico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimentos_manutencao_id ON public.movimentos_estoque(manutencao_id) WHERE manutencao_id IS NOT NULL;

-- Atualiza recebimento para carregar custo da entrada para o kardex.
CREATE OR REPLACE FUNCTION public.rpc_receber_entrada(entrada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_entrada public.entradas_estoque;
BEGIN
  SELECT * INTO v_entrada FROM public.entradas_estoque WHERE id = entrada_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;
  IF v_entrada.status <> 'pendente' THEN RAISE EXCEPTION 'Entrada já processada.'; END IF;

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
    COALESCE(v_entrada.valor_total, COALESCE(v_entrada.valor_unitario, 0) * v_entrada.quantidade),
    entrada_id
  );

  UPDATE public.entradas_estoque SET status = 'recebido' WHERE id = entrada_id;
END;
$$;

-- Atualiza cancelamento para também gerar movimento de estorno com custos.
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
  END IF;

  UPDATE public.entradas_estoque SET status = 'cancelado' WHERE id = entrada_id;
END;
$$;
