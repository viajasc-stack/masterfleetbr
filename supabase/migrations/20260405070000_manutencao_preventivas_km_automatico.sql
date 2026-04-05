-- =============================================================================
-- Manutenção: preventivas automáticas por KM ou data + triagem automática
-- =============================================================================

-- 0) Garante vínculo automático veículo-plano (quando houver km_atual e tipo compatível)
CREATE OR REPLACE FUNCTION public.manutencao_garantir_vinculos_planos_veiculo(
  p_empresa_id uuid,
  p_veiculo_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_empresa_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH novos AS (
    INSERT INTO public.manutencao_veiculo_planos (
      empresa_id,
      veiculo_id,
      plano_id,
      proxima_execucao_km,
      proxima_execucao_data,
      status
    )
    SELECT
      v.empresa_id,
      v.id AS veiculo_id,
      p.id AS plano_id,
      CASE
        WHEN p.intervalo_km IS NOT NULL AND v.km_atual IS NOT NULL THEN COALESCE(v.km_atual, 0) + p.intervalo_km
        ELSE NULL
      END AS proxima_execucao_km,
      CASE
        WHEN p.intervalo_dias IS NOT NULL THEN CURRENT_DATE + p.intervalo_dias
        ELSE NULL
      END AS proxima_execucao_data,
      'em_dia'::public.preventiva_status AS status
    FROM public.veiculos v
    JOIN public.manutencao_planos p
      ON p.empresa_id = v.empresa_id
     AND p.ativo = true
    WHERE v.empresa_id = p_empresa_id
      AND (p_veiculo_id IS NULL OR v.id = p_veiculo_id)
      AND v.km_atual IS NOT NULL
      AND (
        p.tipo_veiculo IS NULL
        OR p.tipo_veiculo = ''
        OR lower(p.tipo_veiculo) = lower(COALESCE(v.tipo, ''))
      )
    ON CONFLICT (veiculo_id, plano_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM novos;

  RETURN v_count;
END;
$$;

-- 1) Processamento interno por empresa (recalcula status, cria solicitação e alerta)
CREATE OR REPLACE FUNCTION public.manutencao_processar_preventivas_empresa(
  p_empresa_id uuid,
  p_veiculo_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
  r RECORD;
BEGIN
  IF p_empresa_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Antes de processar, garante que veículos com km_atual já estejam vinculados aos planos
  PERFORM public.manutencao_garantir_vinculos_planos_veiculo(p_empresa_id, p_veiculo_id);

  -- Recalcula status considerando DATA ou KM (o que vencer primeiro)
  UPDATE public.manutencao_veiculo_planos mvp
  SET status = CASE
    WHEN (
      (mvp.proxima_execucao_data IS NOT NULL AND mvp.proxima_execucao_data < CURRENT_DATE)
      OR
      (mvp.proxima_execucao_km IS NOT NULL AND COALESCE(v.km_atual, 0) >= mvp.proxima_execucao_km)
    ) THEN 'vencida'::public.preventiva_status
    WHEN (
      (mvp.proxima_execucao_data IS NOT NULL AND mvp.proxima_execucao_data <= CURRENT_DATE + 7)
      OR
      (mvp.proxima_execucao_km IS NOT NULL AND COALESCE(v.km_atual, 0) >= GREATEST(mvp.proxima_execucao_km - 500, 0))
    ) THEN 'vencendo_proximo'::public.preventiva_status
    ELSE 'em_dia'::public.preventiva_status
  END
  FROM public.veiculos v
  WHERE mvp.empresa_id = p_empresa_id
    AND (p_veiculo_id IS NULL OR mvp.veiculo_id = p_veiculo_id)
    AND v.id = mvp.veiculo_id
    AND v.empresa_id = p_empresa_id;

  -- Gera solicitação de triagem automática para preventivas vencidas/vencendo
  FOR r IN
    SELECT
      mvp.id,
      mvp.veiculo_id,
      mvp.plano_id,
      mvp.status,
      mvp.proxima_execucao_data,
      mvp.proxima_execucao_km,
      mp.nome AS plano_nome,
      v.km_atual
    FROM public.manutencao_veiculo_planos mvp
    JOIN public.manutencao_planos mp ON mp.id = mvp.plano_id
    JOIN public.veiculos v ON v.id = mvp.veiculo_id
    WHERE mvp.empresa_id = p_empresa_id
      AND (p_veiculo_id IS NULL OR mvp.veiculo_id = p_veiculo_id)
      AND mvp.status IN ('vencida', 'vencendo_proximo')
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.manutencao_solicitacoes s
      WHERE s.empresa_id = p_empresa_id
        AND s.veiculo_id = r.veiculo_id
        AND s.origem = 'preventiva'::public.solicitacao_manutencao_origem
        AND s.status IN ('nova', 'em_analise', 'aprovada')
        AND s.descricao ILIKE ('%' || r.plano_id::text || '%')
    ) THEN
      INSERT INTO public.manutencao_solicitacoes (
        empresa_id,
        veiculo_id,
        categoria,
        titulo,
        descricao,
        prioridade,
        status,
        origem,
        km_atual,
        fotos,
        created_by,
        updated_by
      ) VALUES (
        p_empresa_id,
        r.veiculo_id,
        'outros'::public.manutencao_categoria,
        CASE WHEN r.status = 'vencida' THEN 'Preventiva vencida: ' || COALESCE(r.plano_nome, 'Plano') ELSE 'Preventiva próxima: ' || COALESCE(r.plano_nome, 'Plano') END,
        'Solicitação criada automaticamente por plano preventivo.' || E'\n'
          || 'plano_id=' || r.plano_id::text || E'\n'
          || 'proxima_execucao_data=' || COALESCE(r.proxima_execucao_data::text, 'n/a') || E'\n'
          || 'proxima_execucao_km=' || COALESCE(r.proxima_execucao_km::text, 'n/a') || E'\n'
          || 'km_atual_veiculo=' || COALESCE(r.km_atual::text, 'n/a'),
        CASE WHEN r.status = 'vencida' THEN 'alta'::public.manutencao_prioridade ELSE 'media'::public.manutencao_prioridade END,
        'nova'::public.solicitacao_manutencao_status,
        'preventiva'::public.solicitacao_manutencao_origem,
        r.km_atual,
        '{}'::text[],
        auth.uid(),
        auth.uid()
      );

      v_count := v_count + 1;
    END IF;

    -- Gera alerta sem duplicar enquanto houver alerta não lido
    IF r.status = 'vencida' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.manutencao_alertas a
        WHERE a.empresa_id = p_empresa_id
          AND a.veiculo_plano_id = r.id
          AND a.tipo = 'preventiva_vencida'::public.alerta_manutencao_tipo
          AND a.lido = false
      ) THEN
        INSERT INTO public.manutencao_alertas (
          empresa_id,
          veiculo_id,
          veiculo_plano_id,
          tipo,
          severidade,
          titulo,
          mensagem
        ) VALUES (
          p_empresa_id,
          r.veiculo_id,
          r.id,
          'preventiva_vencida'::public.alerta_manutencao_tipo,
          'alta'::public.alerta_manutencao_severidade,
          'Preventiva vencida por KM/data',
          'Plano ' || COALESCE(r.plano_nome, 'preventivo') || ' está vencido e precisa de triagem.'
        );
      END IF;
    ELSIF r.status = 'vencendo_proximo' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.manutencao_alertas a
        WHERE a.empresa_id = p_empresa_id
          AND a.veiculo_plano_id = r.id
          AND a.tipo = 'preventiva_vencendo'::public.alerta_manutencao_tipo
          AND a.lido = false
      ) THEN
        INSERT INTO public.manutencao_alertas (
          empresa_id,
          veiculo_id,
          veiculo_plano_id,
          tipo,
          severidade,
          titulo,
          mensagem
        ) VALUES (
          p_empresa_id,
          r.veiculo_id,
          r.id,
          'preventiva_vencendo'::public.alerta_manutencao_tipo,
          'media'::public.alerta_manutencao_severidade,
          'Preventiva próxima do vencimento',
          'Plano ' || COALESCE(r.plano_nome, 'preventivo') || ' está próximo do vencimento e deve entrar na triagem.'
        );
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 2) Wrapper atual da aplicação (sem mudar assinatura)
CREATE OR REPLACE FUNCTION public.manutencao_processar_preventivas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  RETURN public.manutencao_processar_preventivas_empresa(v_empresa_id, NULL);
END;
$$;

-- 3) Geração de alertas passa a usar status recalculado por KM/data
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
  IF v_empresa_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Recalcula status antes de gerar alertas
  UPDATE public.manutencao_veiculo_planos mvp
  SET status = CASE
    WHEN (
      (mvp.proxima_execucao_data IS NOT NULL AND mvp.proxima_execucao_data < CURRENT_DATE)
      OR
      (mvp.proxima_execucao_km IS NOT NULL AND COALESCE(v.km_atual, 0) >= mvp.proxima_execucao_km)
    ) THEN 'vencida'::public.preventiva_status
    WHEN (
      (mvp.proxima_execucao_data IS NOT NULL AND mvp.proxima_execucao_data <= CURRENT_DATE + 7)
      OR
      (mvp.proxima_execucao_km IS NOT NULL AND COALESCE(v.km_atual, 0) >= GREATEST(mvp.proxima_execucao_km - 500, 0))
    ) THEN 'vencendo_proximo'::public.preventiva_status
    ELSE 'em_dia'::public.preventiva_status
  END
  FROM public.veiculos v
  WHERE mvp.empresa_id = v_empresa_id
    AND v.id = mvp.veiculo_id
    AND v.empresa_id = v_empresa_id;

  FOR r IN
    SELECT mvp.id, mvp.veiculo_id, mp.nome AS plano_nome
    FROM public.manutencao_veiculo_planos mvp
    JOIN public.manutencao_planos mp ON mp.id = mvp.plano_id
    WHERE mvp.empresa_id = v_empresa_id
      AND mvp.status = 'vencida'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.manutencao_alertas a
      WHERE a.empresa_id = v_empresa_id
        AND a.veiculo_plano_id = r.id
        AND a.tipo = 'preventiva_vencida'::public.alerta_manutencao_tipo
        AND a.lido = false
    ) THEN
      INSERT INTO public.manutencao_alertas (
        empresa_id, veiculo_id, veiculo_plano_id, tipo, severidade, titulo, mensagem
      ) VALUES (
        v_empresa_id, r.veiculo_id, r.id,
        'preventiva_vencida'::public.alerta_manutencao_tipo,
        'alta'::public.alerta_manutencao_severidade,
        'Preventiva vencida por KM/data',
        'Plano ' || COALESCE(r.plano_nome, 'preventivo') || ' está vencido e precisa de triagem.'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT mvp.id, mvp.veiculo_id, mp.nome AS plano_nome
    FROM public.manutencao_veiculo_planos mvp
    JOIN public.manutencao_planos mp ON mp.id = mvp.plano_id
    WHERE mvp.empresa_id = v_empresa_id
      AND mvp.status = 'vencendo_proximo'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.manutencao_alertas a
      WHERE a.empresa_id = v_empresa_id
        AND a.veiculo_plano_id = r.id
        AND a.tipo = 'preventiva_vencendo'::public.alerta_manutencao_tipo
        AND a.lido = false
    ) THEN
      INSERT INTO public.manutencao_alertas (
        empresa_id, veiculo_id, veiculo_plano_id, tipo, severidade, titulo, mensagem
      ) VALUES (
        v_empresa_id, r.veiculo_id, r.id,
        'preventiva_vencendo'::public.alerta_manutencao_tipo,
        'media'::public.alerta_manutencao_severidade,
        'Preventiva próxima do vencimento',
        'Plano ' || COALESCE(r.plano_nome, 'preventivo') || ' está próximo do vencimento e deve entrar na triagem.'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 4) Trigger: ao atualizar KM do veículo, reprocessa preventivas automaticamente
CREATE OR REPLACE FUNCTION public.trg_manutencao_reprocessar_preventivas_km()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.km_atual IS NOT NULL THEN
      PERFORM public.manutencao_garantir_vinculos_planos_veiculo(NEW.empresa_id, NEW.id);
      PERFORM public.manutencao_processar_preventivas_empresa(NEW.empresa_id, NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.km_atual IS DISTINCT FROM OLD.km_atual OR NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    -- Se o tipo mudou ou se o km apareceu/alterou, garante vínculos com planos compatíveis
    PERFORM public.manutencao_garantir_vinculos_planos_veiculo(NEW.empresa_id, NEW.id);
    PERFORM public.manutencao_processar_preventivas_empresa(NEW.empresa_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_veiculos_manutencao_preventivas_km ON public.veiculos;
CREATE TRIGGER trg_veiculos_manutencao_preventivas_km
AFTER INSERT OR UPDATE OF km_atual, tipo ON public.veiculos
FOR EACH ROW
EXECUTE FUNCTION public.trg_manutencao_reprocessar_preventivas_km();

-- 5) Backfill inicial para veículos já existentes com km preenchido
SELECT public.manutencao_garantir_vinculos_planos_veiculo(public.minha_empresa_id(), NULL);
