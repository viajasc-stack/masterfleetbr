-- Contratos: configuração de cobrança
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS forma_cobranca text NOT NULL DEFAULT 'dia'
    CHECK (forma_cobranca IN ('km', 'dia', 'mensal')),
  ADD COLUMN IF NOT EXISTS valor_cobranca numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_fechamento int,
  ADD COLUMN IF NOT EXISTS dia_vencimento int;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contratos_dia_fechamento_check'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_dia_fechamento_check
      CHECK (dia_fechamento IS NULL OR (dia_fechamento BETWEEN 1 AND 31));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contratos_dia_vencimento_check'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_dia_vencimento_check
      CHECK (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 31));
  END IF;
END $$;

UPDATE public.contratos
   SET forma_cobranca = COALESCE(forma_cobranca, 'dia'),
       valor_cobranca = COALESCE(valor_cobranca, 0),
       dia_fechamento = COALESCE(dia_fechamento, 25),
       dia_vencimento = COALESCE(dia_vencimento, 5)
 WHERE forma_cobranca IS NULL
    OR valor_cobranca IS NULL
    OR dia_fechamento IS NULL
    OR dia_vencimento IS NULL;

CREATE OR REPLACE FUNCTION public.os_sync_financeiro_contrato_mensal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_forma text;
  v_valor numeric;
  v_dia_venc int;
  v_comp_ini date;
  v_venc date;
  v_ultimo_dia int;
  v_exist uuid;
BEGIN
  IF NEW.tipo <> 'recorrente' OR NEW.contrato_id IS NULL OR NEW.inicio_em IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.forma_cobranca, c.valor_cobranca, c.dia_vencimento
    INTO v_forma, v_valor, v_dia_venc
  FROM public.contratos c
  WHERE c.id = NEW.contrato_id;

  IF COALESCE(v_forma, 'dia') <> 'mensal' OR COALESCE(v_valor, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_comp_ini := date_trunc('month', (NEW.inicio_em AT TIME ZONE 'UTC'))::date;
  v_ultimo_dia := EXTRACT(day FROM (date_trunc('month', v_comp_ini) + interval '1 month - 1 day'))::int;
  v_venc := make_date(
    EXTRACT(year FROM v_comp_ini)::int,
    EXTRACT(month FROM v_comp_ini)::int,
    LEAST(GREATEST(COALESCE(v_dia_venc, 5), 1), v_ultimo_dia)
  );

  SELECT id INTO v_exist
    FROM public.contas_financeiras cf
   WHERE cf.empresa_id = NEW.empresa_id
     AND cf.contrato_id = NEW.contrato_id
     AND cf.categoria = 'contrato_mensal'
     AND date_trunc('month', cf.data_vencimento)::date = date_trunc('month', v_venc)::date
     AND COALESCE(cf.status, 'pendente') <> 'cancelado'
   LIMIT 1;

  IF v_exist IS NULL THEN
    INSERT INTO public.contas_financeiras (
      empresa_id,
      descricao,
      tipo,
      valor,
      data_vencimento,
      status,
      categoria,
      contrato_id
    ) VALUES (
      NEW.empresa_id,
      'Mensalidade contrato ' || LEFT(NEW.contrato_id::text, 8) || ' (' || to_char(v_comp_ini, 'MM/YYYY') || ')',
      'receber',
      v_valor,
      v_venc,
      'pendente',
      'contrato_mensal',
      NEW.contrato_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_sync_financeiro_contrato_mensal ON public.ordens_servico;

CREATE TRIGGER trg_os_sync_financeiro_contrato_mensal
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.os_sync_financeiro_contrato_mensal();
