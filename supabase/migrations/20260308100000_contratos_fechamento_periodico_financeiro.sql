-- Fechamento periódico de contratos com geração financeira por forma de cobrança

-- Desativa trigger de mensalidade por OS (substituído por rotina de fechamento)
DROP TRIGGER IF EXISTS trg_os_sync_financeiro_contrato_mensal ON public.ordens_servico;
DROP FUNCTION IF EXISTS public.os_sync_financeiro_contrato_mensal();

CREATE TABLE IF NOT EXISTS public.contrato_fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  data_fechamento date NOT NULL,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  forma_cobranca text NOT NULL CHECK (forma_cobranca IN ('km', 'dia', 'mensal')),
  quantidade_base numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  conta_financeira_id uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processado' CHECK (status IN ('processado', 'sem_movimento')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, periodo_inicio, periodo_fim)
);

ALTER TABLE public.contrato_fechamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contrato_fechamentos_empresa" ON public.contrato_fechamentos;
DROP POLICY IF EXISTS "contrato_fechamentos_insert" ON public.contrato_fechamentos;
DROP POLICY IF EXISTS "contrato_fechamentos_update" ON public.contrato_fechamentos;

CREATE POLICY "contrato_fechamentos_empresa"
  ON public.contrato_fechamentos
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "contrato_fechamentos_insert"
  ON public.contrato_fechamentos
  FOR INSERT
  WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "contrato_fechamentos_update"
  ON public.contrato_fechamentos
  FOR UPDATE
  USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_contrato_fechamentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_fechamentos_empresa ON public.contrato_fechamentos;
CREATE TRIGGER trg_contrato_fechamentos_empresa
  BEFORE INSERT ON public.contrato_fechamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_contrato_fechamentos();

CREATE INDEX IF NOT EXISTS idx_contrato_fechamentos_contrato_data
  ON public.contrato_fechamentos (contrato_id, data_fechamento DESC);

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
  r record;
BEGIN
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
      AND (c.data_inicio IS NULL OR c.data_inicio <= p_data_ref)
      AND (c.data_fim IS NULL OR c.data_fim >= p_data_ref)
      AND COALESCE(c.dia_fechamento, 25) = EXTRACT(day FROM p_data_ref)::int
  LOOP
    v_total_contratos := v_total_contratos + 1;

    SELECT COALESCE(MAX(cf.periodo_fim) + 1, COALESCE(r.data_inicio, p_data_ref))
      INTO v_periodo_inicio
    FROM public.contrato_fechamentos cf
    WHERE cf.contrato_id = r.id;

    v_periodo_fim := COALESCE(LEAST(p_data_ref, r.data_fim), p_data_ref);

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

-- Agendamento diário (quando pg_cron estiver disponível no projeto)
DO $$
DECLARE
  v_jobid int;
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = 'processar-fechamento-contratos-diario'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  PERFORM cron.schedule(
    'processar-fechamento-contratos-diario',
    '5 2 * * *',
    'SELECT public.processar_fechamento_contratos(CURRENT_DATE, NULL);'
  );
EXCEPTION
  WHEN undefined_table OR insufficient_privilege OR feature_not_supported THEN
    RAISE NOTICE 'pg_cron não disponível/permitido neste ambiente; execute processar_fechamento_contratos manualmente ou via scheduler externo.';
END;
$$;
