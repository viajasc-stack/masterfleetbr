-- Extra de motorista por OS manual + integração automática com financeiro

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS pagar_extra_motorista boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_extra_motorista numeric,
  ADD COLUMN IF NOT EXISTS extra_motorista_lancado_em timestamptz,
  ADD COLUMN IF NOT EXISTS extra_motorista_conta_id uuid REFERENCES public.contas_financeiras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_os_extra_motorista
  ON public.ordens_servico (empresa_id, pagar_extra_motorista, status)
  WHERE pagar_extra_motorista = true;

CREATE OR REPLACE FUNCTION public.os_processar_extra_motorista()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valor numeric;
  v_extra_id uuid;
  v_conta_id uuid;
  v_data_base date;
  v_competencia date;
  v_motorista_nome text;
  v_exist_extra uuid;
  v_exist_conta uuid;
BEGIN
  -- Só processa quando OS estiver concluída/finalizada
  IF lower(COALESCE(NEW.status, '')) NOT IN ('concluida', 'finalizada') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.pagar_extra_motorista, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.motorista_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_valor := COALESCE(NEW.valor_extra_motorista, 0);
  IF v_valor <= 0 THEN
    RETURN NEW;
  END IF;

  -- Evita duplicidade de extra por OS
  SELECT me.id INTO v_exist_extra
  FROM public.motorista_extras me
  WHERE me.ordem_servico_id = NEW.id
    AND me.tipo = 'extra_os'
  LIMIT 1;

  IF v_exist_extra IS NULL THEN
    v_data_base := COALESCE((NEW.fim_em AT TIME ZONE 'America/Sao_Paulo')::date, CURRENT_DATE);
    v_competencia := date_trunc('month', v_data_base::timestamp)::date;

    INSERT INTO public.motorista_extras (
      empresa_id,
      motorista_id,
      ordem_servico_id,
      tipo,
      descricao,
      valor,
      status,
      competencia
    ) VALUES (
      NEW.empresa_id,
      NEW.motorista_id,
      NEW.id,
      'extra_os',
      'Extra por OS #' || COALESCE(NEW.numero::text, LEFT(NEW.id::text, 8)),
      v_valor,
      'pendente',
      v_competencia
    )
    RETURNING id INTO v_extra_id;
  ELSE
    v_extra_id := v_exist_extra;
  END IF;

  -- Evita duplicidade de conta financeira do extra
  SELECT cf.id INTO v_exist_conta
  FROM public.contas_financeiras cf
  WHERE cf.os_id = NEW.id
    AND cf.tipo = 'pagar'
    AND cf.categoria = 'motorista_extra'
  LIMIT 1;

  IF v_exist_conta IS NULL THEN
    SELECT m.nome INTO v_motorista_nome
    FROM public.motoristas m
    WHERE m.id = NEW.motorista_id
    LIMIT 1;

    INSERT INTO public.contas_financeiras (
      empresa_id,
      descricao,
      tipo,
      valor,
      data_vencimento,
      status,
      categoria,
      os_id,
      observacoes
    ) VALUES (
      NEW.empresa_id,
      'Extra motorista - OS #' || COALESCE(NEW.numero::text, LEFT(NEW.id::text, 8)),
      'pagar',
      v_valor,
      COALESCE((NEW.fim_em AT TIME ZONE 'America/Sao_Paulo')::date, CURRENT_DATE),
      'pendente',
      'motorista_extra',
      NEW.id,
      'motorista_id=' || NEW.motorista_id::text || '; motorista_nome=' || COALESCE(v_motorista_nome, 'N/I') || '; motorista_extra_id=' || COALESCE(v_extra_id::text, 'N/I')
    )
    RETURNING id INTO v_conta_id;
  ELSE
    v_conta_id := v_exist_conta;
  END IF;

  UPDATE public.ordens_servico
    SET extra_motorista_lancado_em = COALESCE(extra_motorista_lancado_em, now()),
        extra_motorista_conta_id = COALESCE(extra_motorista_conta_id, v_conta_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_extra_motorista_after_insert ON public.ordens_servico;
CREATE TRIGGER trg_os_extra_motorista_after_insert
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.os_processar_extra_motorista();

DROP TRIGGER IF EXISTS trg_os_extra_motorista_after_update ON public.ordens_servico;
CREATE TRIGGER trg_os_extra_motorista_after_update
  AFTER UPDATE OF status, pagar_extra_motorista, valor_extra_motorista, motorista_id ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.os_processar_extra_motorista();
