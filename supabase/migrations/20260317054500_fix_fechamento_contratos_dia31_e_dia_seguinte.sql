-- Ajuste de regra de fechamento de contratos:
-- 1) O fechamento roda no dia seguinte ao dia configurado no contrato.
-- 2) Dia 31 significa "último dia do mês" (28/29/30/31 conforme mês).
-- 3) O dia de fechamento entra no período (intervalo inclusivo no fim).

CREATE OR REPLACE FUNCTION public.processar_fechamento_contratos(
  p_data_ref date DEFAULT CURRENT_DATE,
  p_contrato_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_contratos int := 0;
  v_total_processados int := 0;
  v_total_sem_mov int := 0;
  v_total_contas int := 0;
  v_venc date;
  v_qtd numeric;
  v_valor_total numeric;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_conta_id uuid;
  v_ultimo_dia int;
  v_fechamento_ref date;
  v_fechamento_month_last_day date;
  v_fechamento_month_days int;
  r record;
BEGIN
  -- O fechamento sempre considera o dia anterior ao processamento
  -- (ex.: processa dia 16 => fecha dia 15; processa dia 01 => fecha último dia do mês anterior).
  v_fechamento_ref := (p_data_ref - interval '1 day')::date;
  v_fechamento_month_last_day := (date_trunc('month', v_fechamento_ref::timestamp) + interval '1 month - 1 day')::date;
  v_fechamento_month_days := EXTRACT(day FROM v_fechamento_month_last_day)::int;

  FOR r IN
    SELECT
      c.id,
      c.empresa_id,
      c.nome,
      c.forma_cobranca,
      COALESCE(c.valor_cobranca, 0) AS valor_cobranca,
      c.data_inicio,
      c.data_fim,
      COALESCE(c.dia_fechamento, 25) AS dia_fechamento,
      COALESCE(c.dia_vencimento, 5) AS dia_vencimento
    FROM public.contratos c
    WHERE c.ativo = true
      AND (p_contrato_id IS NULL OR c.id = p_contrato_id)
      AND (
        LEAST(GREATEST(COALESCE(c.dia_fechamento, 25), 1), v_fechamento_month_days)
      ) = EXTRACT(day FROM v_fechamento_ref)::int
  LOOP
    v_total_contratos := v_total_contratos + 1;

    -- Dia efetivo de fechamento (sempre o dia anterior ao processamento)
    -- já calculado em v_fechamento_ref e com elegibilidade por dia acima.

    -- Contrato precisa estar vigente no dia efetivo de fechamento
    IF (r.data_inicio IS NOT NULL AND r.data_inicio > v_fechamento_ref)
       OR (r.data_fim IS NOT NULL AND r.data_fim < v_fechamento_ref) THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(MAX(cf.periodo_fim) + 1, COALESCE(r.data_inicio, v_fechamento_ref))
      INTO v_periodo_inicio
    FROM public.contrato_fechamentos cf
    WHERE cf.contrato_id = r.id;

    v_periodo_fim := COALESCE(LEAST(v_fechamento_ref, r.data_fim), v_fechamento_ref);

    IF v_periodo_inicio > v_periodo_fim THEN
      CONTINUE;
    END IF;

    v_qtd := 0;
    v_valor_total := 0;

    IF r.forma_cobranca = 'mensal' THEN
      v_qtd := 1;
      v_valor_total := r.valor_cobranca;

    ELSIF r.forma_cobranca = 'dia' THEN
      SELECT COALESCE(COUNT(DISTINCT (os.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date), 0)
        INTO v_qtd
      FROM public.ordens_servico os
      WHERE os.contrato_id = r.id
        AND os.status <> 'cancelada'
        AND os.inicio_em IS NOT NULL
        AND (os.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_periodo_inicio AND v_periodo_fim;

      v_valor_total := v_qtd * r.valor_cobranca;

    ELSIF r.forma_cobranca = 'km' THEN
      SELECT COALESCE(
        SUM(
          GREATEST(
            COALESCE(os.km_fim, os.km_final, 0) - COALESCE(os.km_inicio, os.km_inicial, 0),
            0
          )
        ),
        0
      )
        INTO v_qtd
      FROM public.ordens_servico os
      WHERE os.contrato_id = r.id
        AND os.status <> 'cancelada'
        AND os.inicio_em IS NOT NULL
        AND (os.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_periodo_inicio AND v_periodo_fim;

      v_valor_total := v_qtd * r.valor_cobranca;
    END IF;

    v_ultimo_dia := EXTRACT(day FROM (date_trunc('month', p_data_ref::timestamp) + interval '1 month - 1 day'))::int;
    v_venc := make_date(
      EXTRACT(year FROM p_data_ref)::int,
      EXTRACT(month FROM p_data_ref)::int,
      LEAST(GREATEST(r.dia_vencimento, 1), v_ultimo_dia)
    );

    IF v_venc < p_data_ref THEN
      v_ultimo_dia := EXTRACT(day FROM (date_trunc('month', (p_data_ref + interval '1 month')::timestamp) + interval '1 month - 1 day'))::int;
      v_venc := make_date(
        EXTRACT(year FROM (p_data_ref + interval '1 month'))::int,
        EXTRACT(month FROM (p_data_ref + interval '1 month'))::int,
        LEAST(GREATEST(r.dia_vencimento, 1), v_ultimo_dia)
      );
    END IF;

    v_conta_id := NULL;

    IF v_valor_total > 0 THEN
      INSERT INTO public.contas_financeiras (
        empresa_id,
        descricao,
        tipo,
        valor,
        data_vencimento,
        status,
        categoria,
        contrato_id,
        observacoes
      ) VALUES (
        r.empresa_id,
        'Fechamento contrato ' || COALESCE(r.nome, LEFT(r.id::text, 8)) || ' (' || to_char(v_periodo_inicio, 'DD/MM/YYYY') || ' a ' || to_char(v_periodo_fim, 'DD/MM/YYYY') || ')',
        'receber',
        v_valor_total,
        v_venc,
        'pendente',
        'contrato_fechamento',
        r.id,
        'Forma=' || r.forma_cobranca || '; base=' || COALESCE(v_qtd, 0)::text || '; valor_unit=' || r.valor_cobranca::text
      )
      RETURNING id INTO v_conta_id;

      v_total_contas := v_total_contas + 1;
    END IF;

    INSERT INTO public.contrato_fechamentos (
      empresa_id,
      contrato_id,
      data_fechamento,
      periodo_inicio,
      periodo_fim,
      forma_cobranca,
      quantidade_base,
      valor_unitario,
      valor_total,
      conta_financeira_id,
      status
    ) VALUES (
      r.empresa_id,
      r.id,
      p_data_ref,
      v_periodo_inicio,
      v_periodo_fim,
      r.forma_cobranca,
      v_qtd,
      r.valor_cobranca,
      v_valor_total,
      v_conta_id,
      CASE WHEN v_valor_total > 0 THEN 'processado' ELSE 'sem_movimento' END
    )
    ON CONFLICT (contrato_id, periodo_inicio, periodo_fim)
    DO NOTHING;

    v_total_processados := v_total_processados + 1;
    IF v_valor_total <= 0 THEN
      v_total_sem_mov := v_total_sem_mov + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'data_referencia', p_data_ref,
    'contratos_lidos', v_total_contratos,
    'fechamentos_gerados', v_total_processados,
    'sem_movimento', v_total_sem_mov,
    'contas_geradas', v_total_contas
  );
END;
$$;
