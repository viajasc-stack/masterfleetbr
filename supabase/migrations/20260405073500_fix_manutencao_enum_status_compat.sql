-- =============================================================================
-- Hotfix Manutenção: compatibilidade de status legado "andamento"
-- Evita erro: invalid input value for enum ordem_manutencao_status: "em_andamento"
-- =============================================================================

-- Garante que o enum aceite também o valor novo, sem quebrar bases legadas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordem_manutencao_status') THEN
    BEGIN
      ALTER TYPE public.ordem_manutencao_status ADD VALUE IF NOT EXISTS 'em_andamento';
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- RPC: KPIs DE MANUTENÇÃO (compatível com enum legado: andamento)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_kpis(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_inicio date;
  v_fim date;
  v_result json;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  v_inicio := COALESCE(p_data_inicio, (CURRENT_DATE - INTERVAL '30 days')::date);
  v_fim := COALESCE(p_data_fim, CURRENT_DATE);

  SELECT json_build_object(
    'total_os', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'os_abertas', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status::text = 'aberta'), 0),
    'os_em_andamento', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status::text IN ('em_andamento', 'andamento')), 0),
    'os_aguardando_pecas', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status::text = 'aguardando_pecas'), 0),
    'os_finalizadas', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status::text = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'solicitacoes_novas', COALESCE((SELECT COUNT(*) FROM public.manutencao_solicitacoes WHERE empresa_id = v_empresa_id AND status = 'nova'), 0),
    'custo_total_periodo', COALESCE((SELECT SUM(custo_total) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status::text = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'custo_medio_por_os', COALESCE((SELECT AVG(custo_total) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status::text = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'preventivas_vencidas', COALESCE((SELECT COUNT(*) FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status = 'vencida'), 0),
    'alertas_nao_lidos', COALESCE((SELECT COUNT(*) FROM public.manutencao_alertas WHERE empresa_id = v_empresa_id AND lido = false), 0),
    'top_veiculos_custos', COALESCE((
      SELECT json_agg(json_build_object('veiculo_id', veiculo_id, 'placa', placa, 'modelo', modelo, 'total', total_custo))
      FROM (
        SELECT o.veiculo_id, v.placa, v.modelo, SUM(o.custo_total) as total_custo
        FROM public.manutencao_ordens o
        JOIN public.veiculos v ON v.id = o.veiculo_id
        WHERE o.empresa_id = v_empresa_id AND o.status::text = 'finalizada' AND o.created_at::date BETWEEN v_inicio AND v_fim
        GROUP BY o.veiculo_id, v.placa, v.modelo
        ORDER BY total_custo DESC
        LIMIT 5
      ) sub
    ), '[]'::json),
    'custo_por_categoria', COALESCE((
      SELECT json_agg(json_build_object('categoria', categoria, 'total', total_custo, 'count', total_count))
      FROM (
        SELECT categoria::text, SUM(custo_total) as total_custo, COUNT(*) as total_count
        FROM public.manutencao_ordens
        WHERE empresa_id = v_empresa_id AND status::text = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim AND categoria IS NOT NULL
        GROUP BY categoria
        ORDER BY total_custo DESC
      ) sub
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: GERAR ALERTAS AUTOMÁTICOS (compatível com andamento/em_andamento)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_gerar_alertas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_count integer := 0;
  r RECORD;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  -- Preventivas vencidas
  FOR r IN SELECT * FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status = 'vencida' LOOP
    INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, veiculo_plano_id, tipo, severidade, titulo, mensagem)
    VALUES (v_empresa_id, r.veiculo_id, r.id, 'preventiva_vencida', 'alta', 'Preventiva vencida', 'Veículo possui manutenção preventiva vencida.')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- Preventivas vencendo em 7 dias
  FOR r IN SELECT * FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status = 'vencendo_proximo' AND proxima_execucao_data <= CURRENT_DATE + 7 LOOP
    INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, veiculo_plano_id, tipo, severidade, titulo, mensagem)
    VALUES (v_empresa_id, r.veiculo_id, r.id, 'preventiva_vencendo', 'media', 'Preventiva vencendo', 'Manutenção preventiva vence em breve.')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- OS atrasadas (mais de 7 dias em andamento)
  FOR r IN
    SELECT *
    FROM public.manutencao_ordens
    WHERE empresa_id = v_empresa_id
      AND status::text IN ('em_andamento', 'andamento')
      AND data_entrada < now() - INTERVAL '7 days'
  LOOP
    INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, ordem_id, tipo, severidade, titulo, mensagem)
    VALUES (v_empresa_id, r.veiculo_id, r.id, 'os_atrasada', 'alta', 'OS atrasada', 'Ordem de serviço em andamento há mais de 7 dias.')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: PROCESSAR PREVENTIVAS (compatível com andamento/em_andamento)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_processar_preventivas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_count integer := 0;
  r RECORD;
  v_ordem_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  FOR r IN SELECT * FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status IN ('vencida', 'vencendo_proximo') LOOP
    -- Verifica se já existe OS aberta para este veículo/plano
    IF NOT EXISTS (
      SELECT 1
      FROM public.manutencao_ordens
      WHERE veiculo_id = r.veiculo_id
        AND status::text IN ('aberta', 'em_andamento', 'andamento')
        AND tipo = 'preventiva'
    ) THEN
      INSERT INTO public.manutencao_ordens (
        empresa_id, veiculo_id, tipo, status, prioridade,
        diagnostico, data_entrada, created_by
      ) VALUES (
        v_empresa_id, r.veiculo_id, 'preventiva', 'aberta', 'media',
        'Manutenção preventiva programada.', now(), auth.uid()
      ) RETURNING id INTO v_ordem_id;

      -- Adiciona itens do plano
      INSERT INTO public.manutencao_ordens_servicos (empresa_id, ordem_id, tipo_servico_id, quantidade_horas, valor_hora, valor_total)
      SELECT v_empresa_id, v_ordem_id, tipo_servico_id, 0, 0, 0
      FROM public.manutencao_planos_itens WHERE plano_id = r.plano_id AND tipo_servico_id IS NOT NULL;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Atualiza status dos planos
  UPDATE public.manutencao_veiculo_planos
  SET status = CASE
    WHEN proxima_execucao_data IS NOT NULL AND proxima_execucao_data < CURRENT_DATE THEN 'vencida'
    WHEN proxima_execucao_data IS NOT NULL AND proxima_execucao_data <= CURRENT_DATE + 7 THEN 'vencendo_proximo'
    ELSE 'em_dia'
  END
  WHERE empresa_id = v_empresa_id;

  RETURN v_count;
END;
$$;
