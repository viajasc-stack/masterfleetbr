-- Configuração + rotina automática de geração de OS para fretamento recorrente

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS fretamento_recorrente_auto_geracao_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fretamento_recorrente_auto_limiar_dias integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS fretamento_recorrente_auto_janela_dias integer NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_fretamento_recorrente_auto_limiar_dias_chk'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_fretamento_recorrente_auto_limiar_dias_chk
      CHECK (fretamento_recorrente_auto_limiar_dias >= 0 AND fretamento_recorrente_auto_limiar_dias <= 30);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_fretamento_recorrente_auto_janela_dias_chk'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_fretamento_recorrente_auto_janela_dias_chk
      CHECK (fretamento_recorrente_auto_janela_dias >= 1 AND fretamento_recorrente_auto_janela_dias <= 30);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_auto_geracao_fretamento_recorrente(
  p_empresa_id uuid DEFAULT NULL,
  p_data_ref date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_data_ultima_os date;
  v_dias_restantes integer;
  v_data_inicio_geracao date;
  v_data_ref_loop date;
  v_qtd_dia integer;
  v_total_empresas integer := 0;
  v_total_contratos integer := 0;
  v_total_contratos_acionados integer := 0;
  v_total_os_geradas integer := 0;
BEGIN
  FOR r IN
    SELECT
      e.id AS empresa_id,
      e.fretamento_recorrente_auto_limiar_dias AS limiar_dias,
      e.fretamento_recorrente_auto_janela_dias AS janela_dias,
      c.id AS contrato_id
    FROM public.empresas e
    JOIN public.contratos c ON c.empresa_id = e.id
    WHERE e.fretamento_recorrente_auto_geracao_ativo = true
      AND (p_empresa_id IS NULL OR e.id = p_empresa_id)
      AND c.ativo = true
      AND (c.data_inicio IS NULL OR c.data_inicio <= p_data_ref)
      AND (c.data_fim IS NULL OR c.data_fim >= p_data_ref)
      AND EXISTS (
        SELECT 1
        FROM public.contrato_horarios ch
        WHERE ch.contrato_id = c.id
          AND ch.ativo = true
      )
    ORDER BY e.id, c.id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.empresas e2
      WHERE e2.id = r.empresa_id
    ) THEN
      CONTINUE;
    END IF;

    -- conta empresas processadas
    IF NOT EXISTS (
      SELECT 1
      FROM (
        SELECT e3.id
        FROM public.empresas e3
        WHERE e3.fretamento_recorrente_auto_geracao_ativo = true
          AND (p_empresa_id IS NULL OR e3.id = p_empresa_id)
          AND e3.id = r.empresa_id
      ) x
      WHERE false
    ) THEN
      NULL;
    END IF;

    SELECT MAX((os.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date)
      INTO v_data_ultima_os
    FROM public.ordens_servico os
    WHERE os.contrato_id = r.contrato_id
      AND os.tipo = 'recorrente'
      AND os.status <> 'cancelada';

    IF v_data_ultima_os IS NULL THEN
      v_dias_restantes := -1;
    ELSE
      v_dias_restantes := (v_data_ultima_os - p_data_ref);
    END IF;

    v_total_contratos := v_total_contratos + 1;

    IF v_dias_restantes <= COALESCE(r.limiar_dias, 2) THEN
      v_total_contratos_acionados := v_total_contratos_acionados + 1;

      v_data_inicio_geracao := GREATEST(
        p_data_ref,
        COALESCE(v_data_ultima_os + 1, p_data_ref)
      );

      FOR i IN 0..(COALESCE(r.janela_dias, 7) - 1) LOOP
        v_data_ref_loop := v_data_inicio_geracao + i;
        SELECT COALESCE(public.gerar_os_do_contrato(r.contrato_id, v_data_ref_loop), 0)
          INTO v_qtd_dia;
        v_total_os_geradas := v_total_os_geradas + COALESCE(v_qtd_dia, 0);
      END LOOP;
    END IF;
  END LOOP;

  SELECT COUNT(*)
    INTO v_total_empresas
  FROM public.empresas e
  WHERE e.fretamento_recorrente_auto_geracao_ativo = true
    AND (p_empresa_id IS NULL OR e.id = p_empresa_id);

  RETURN jsonb_build_object(
    'data_referencia', p_data_ref,
    'empresas_processadas', v_total_empresas,
    'contratos_analisados', v_total_contratos,
    'contratos_acionados', v_total_contratos_acionados,
    'os_geradas', v_total_os_geradas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.processar_auto_geracao_fretamento_recorrente(uuid, date) TO authenticated;

DO $$
DECLARE
  v_jobid int;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'processar-auto-fretamento-recorrente-diario'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'processar-auto-fretamento-recorrente-diario',
    '20 2 * * *',
    'SELECT public.processar_auto_geracao_fretamento_recorrente(NULL, CURRENT_DATE);'
  );
EXCEPTION
  WHEN undefined_table OR insufficient_privilege OR feature_not_supported THEN
    RAISE NOTICE 'pg_cron não disponível/permitido neste ambiente; execute processar_auto_geracao_fretamento_recorrente manualmente ou via scheduler externo.';
END;
$$;
