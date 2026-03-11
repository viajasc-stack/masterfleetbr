-- Operação de OS + presença + cobrança do fretamento compartilhado

CREATE OR REPLACE FUNCTION public.rpc_os_sync_passageiros_fretamento(
  p_os_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os public.ordens_servico;
  v_data date;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id = p_os_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  IF v_os.contrato_id IS NULL THEN
    RETURN 0;
  END IF;

  v_data := COALESCE((v_os.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date, CURRENT_DATE);

  INSERT INTO public.os_passageiros_presenca (
    empresa_id,
    os_id,
    passageiro_id,
    contrato_passageiro_id,
    status,
    hora_registro
  )
  SELECT
    v_os.empresa_id,
    v_os.id,
    cp.passageiro_id,
    cp.id,
    'PENDENTE'::public.status_embarque_presenca,
    NULL
  FROM public.contrato_passageiros cp
  JOIN public.contrato_passageiro_participacoes part ON part.contrato_passageiro_id = cp.id
  WHERE cp.contrato_id = v_os.contrato_id
    AND cp.status = 'ATIVO'
    AND part.ativo = true
    AND (cp.data_inicio IS NULL OR cp.data_inicio <= v_data)
    AND (cp.data_fim IS NULL OR cp.data_fim >= v_data)
    AND (v_os.contrato_rota_id IS NULL OR part.contrato_rota_id = v_os.contrato_rota_id)
    AND (v_os.contrato_horario_id IS NULL OR part.contrato_horario_id IS NULL OR part.contrato_horario_id = v_os.contrato_horario_id)
  ON CONFLICT (os_id, passageiro_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_os_atualizar_presenca_passageiro(
  p_os_id uuid,
  p_passageiro_id uuid,
  p_status public.status_embarque_presenca
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_cp_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.ordens_servico WHERE id = p_os_id;
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  SELECT id INTO v_cp_id
  FROM public.contrato_passageiros
  WHERE contrato_id = (SELECT contrato_id FROM public.ordens_servico WHERE id = p_os_id)
    AND passageiro_id = p_passageiro_id
  LIMIT 1;

  INSERT INTO public.os_passageiros_presenca (
    empresa_id,
    os_id,
    passageiro_id,
    contrato_passageiro_id,
    status,
    hora_registro
  ) VALUES (
    v_empresa_id,
    p_os_id,
    p_passageiro_id,
    v_cp_id,
    p_status,
    now()
  )
  ON CONFLICT (os_id, passageiro_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    hora_registro = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_os_do_contrato(
  p_contrato_id uuid,
  p_data date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato public.contratos;
  v_h record;
  v_inserts integer := 0;
  v_os_id uuid;
  v_inicio timestamptz;
  v_qtd integer;
  v_dow int;
BEGIN
  SELECT * INTO v_contrato FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  IF v_contrato.ativo = false THEN
    RETURN 0;
  END IF;

  IF v_contrato.data_inicio IS NOT NULL AND p_data < v_contrato.data_inicio THEN
    RETURN 0;
  END IF;

  IF v_contrato.data_fim IS NOT NULL AND p_data > v_contrato.data_fim THEN
    RETURN 0;
  END IF;

  v_dow := EXTRACT(DOW FROM p_data)::int;

  FOR v_h IN
    SELECT *
    FROM public.contrato_horarios
    WHERE contrato_id = p_contrato_id
      AND ativo = true
      AND (
        (dias_semana IS NULL OR array_length(dias_semana, 1) IS NULL)
        OR v_dow = ANY(dias_semana)
      )
    ORDER BY ordem, hora
  LOOP
    v_inicio := ((p_data::text || ' ' || COALESCE(v_h.hora::text, v_h.horario::text))::timestamp AT TIME ZONE 'America/Sao_Paulo');

    IF EXISTS (
      SELECT 1
      FROM public.ordens_servico os
      WHERE os.contrato_id = p_contrato_id
        AND os.contrato_horario_id = v_h.id
        AND (os.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date = p_data
        AND os.status <> 'cancelada'
    ) THEN
      CONTINUE;
    END IF;

    SELECT COUNT(*)::int INTO v_qtd
    FROM public.contrato_passageiros cp
    JOIN public.contrato_passageiro_participacoes part ON part.contrato_passageiro_id = cp.id
    WHERE cp.contrato_id = p_contrato_id
      AND cp.status = 'ATIVO'
      AND part.ativo = true
      AND (cp.data_inicio IS NULL OR cp.data_inicio <= p_data)
      AND (cp.data_fim IS NULL OR cp.data_fim >= p_data)
      AND (v_h.contrato_rota_id IS NULL OR part.contrato_rota_id = v_h.contrato_rota_id)
      AND (part.contrato_horario_id IS NULL OR part.contrato_horario_id = v_h.id);

    INSERT INTO public.ordens_servico (
      empresa_id,
      tipo,
      status,
      status_pagamento,
      cliente_id,
      veiculo_id,
      motorista_id,
      contrato_id,
      contrato_rota_id,
      contrato_horario_id,
      inicio_em,
      origem,
      destino,
      observacoes,
      qtd_passageiros,
      valor_total
    ) VALUES (
      v_contrato.empresa_id,
      'recorrente',
      'pendente',
      'pendente',
      v_contrato.cliente_id,
      v_h.veiculo_id,
      v_h.motorista_id,
      p_contrato_id,
      v_h.contrato_rota_id,
      v_h.id,
      v_inicio,
      v_h.origem,
      v_h.destino,
      v_h.observacao,
      COALESCE(v_qtd, 0),
      CASE WHEN v_contrato.forma_cobranca = 'dia' THEN COALESCE(v_contrato.valor_cobranca, 0) ELSE 0 END
    ) RETURNING id INTO v_os_id;

    PERFORM public.rpc_os_sync_passageiros_fretamento(v_os_id);
    v_inserts := v_inserts + 1;
  END LOOP;

  RETURN v_inserts;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_contrato_gerar_cobranca_passageiros(
  p_contrato_id uuid,
  p_competencia date DEFAULT date_trunc('month', now())::date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato public.contratos;
  v_cp record;
  v_ini date;
  v_fim date;
  v_total numeric(12,2);
  v_inserted integer := 0;
  v_desc text;
BEGIN
  SELECT * INTO v_contrato FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato não encontrado';
  END IF;

  v_ini := date_trunc('month', p_competencia)::date;
  v_fim := (date_trunc('month', p_competencia) + interval '1 month - 1 day')::date;

  FOR v_cp IN
    SELECT cp.*, p.nome AS passageiro_nome
    FROM public.contrato_passageiros cp
    JOIN public.passageiros p ON p.id = cp.passageiro_id
    WHERE cp.contrato_id = p_contrato_id
      AND cp.status = 'ATIVO'
      AND (cp.data_inicio IS NULL OR cp.data_inicio <= v_fim)
      AND (cp.data_fim IS NULL OR cp.data_fim >= v_ini)
  LOOP
    IF v_cp.tipo_cobranca = 'MENSAL' THEN
      v_total := COALESCE(v_cp.valor, 0);
    ELSE
      SELECT COALESCE(COUNT(*) * COALESCE(v_cp.valor, 0), 0)::numeric(12,2)
        INTO v_total
      FROM public.os_passageiros_presenca pr
      JOIN public.ordens_servico os ON os.id = pr.os_id
      WHERE os.contrato_id = p_contrato_id
        AND pr.passageiro_id = v_cp.passageiro_id
        AND pr.status = 'EMBARCOU'
        AND (os.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_ini AND v_fim;
    END IF;

    IF v_total <= 0 THEN
      CONTINUE;
    END IF;

    v_desc := format('Fretamento %s • %s • %s', v_ini::text, v_contrato.nome, v_cp.passageiro_nome);

    IF EXISTS (
      SELECT 1
      FROM public.contas_financeiras cf
      WHERE cf.contrato_id = p_contrato_id
        AND cf.tipo = 'receber'
        AND cf.descricao = v_desc
        AND cf.data_vencimento BETWEEN v_ini AND (v_fim + 40)
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.contas_financeiras (
      empresa_id,
      descricao,
      tipo,
      valor,
      data_vencimento,
      status,
      categoria,
      observacoes,
      contrato_id
    ) VALUES (
      v_contrato.empresa_id,
      v_desc,
      'receber',
      v_total,
      (date_trunc('month', v_ini) + interval '1 month' + interval '4 days')::date,
      'pendente',
      'fretamento_passageiro',
      jsonb_build_object(
        'contrato_passageiro_id', v_cp.id,
        'passageiro_id', v_cp.passageiro_id,
        'tipo_cobranca', v_cp.tipo_cobranca,
        'competencia', v_ini
      )::text,
      p_contrato_id
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_os_sync_passageiros_fretamento(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_os_atualizar_presenca_passageiro(uuid, uuid, public.status_embarque_presenca) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_os_do_contrato(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_contrato_gerar_cobranca_passageiros(uuid, date) TO authenticated;
