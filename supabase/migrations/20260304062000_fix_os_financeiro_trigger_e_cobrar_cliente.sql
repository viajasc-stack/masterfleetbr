-- Corrige geração financeira automática da OS (FK) e adiciona flag cobrar_cliente

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS cobrar_cliente boolean NOT NULL DEFAULT false;

DROP TRIGGER IF EXISTS trg_os_sync_financeiro_km_fixo_insert ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_sync_financeiro_km_fixo_update ON public.ordens_servico;

CREATE OR REPLACE FUNCTION public.os_sync_financeiro_km_fixo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_os_numero text;
  v_data_base date;
  v_status_fin text;
  v_valor numeric;
  v_existing uuid;
  v_km_inicio numeric;
  v_km_fim numeric;
BEGIN
  v_os_numero := COALESCE('OS-' || LPAD(COALESCE(NEW.numero, 0)::text, 4, '0'), 'OS');
  v_data_base := COALESCE((NEW.inicio_em AT TIME ZONE 'UTC')::date, CURRENT_DATE);

  -- Cobrança fixa: gera conta no momento da criação da OS
  IF TG_OP = 'INSERT' AND COALESCE(NEW.modo_cobranca, 'fixo') = 'fixo' THEN
    v_valor := COALESCE(NEW.valor_fixo, NEW.valor_total, 0);
    IF v_valor > 0 THEN
      SELECT id INTO v_existing
      FROM public.contas_financeiras
      WHERE os_id = NEW.id
      LIMIT 1;

      IF v_existing IS NULL THEN
        v_status_fin := CASE
          WHEN COALESCE(NEW.status_pagamento, 'pendente') IN ('pago', 'recebido') THEN 'recebido'
          WHEN COALESCE(NEW.status_pagamento, 'pendente') = 'cancelado' THEN 'cancelado'
          ELSE 'pendente'
        END;

        INSERT INTO public.contas_financeiras (
          empresa_id,
          descricao,
          tipo,
          valor,
          data_vencimento,
          data_pagamento,
          status,
          categoria,
          os_id
        ) VALUES (
          NEW.empresa_id,
          'Receita ' || v_os_numero,
          'receber',
          v_valor,
          v_data_base,
          CASE WHEN v_status_fin = 'recebido' THEN CURRENT_DATE ELSE NULL END,
          v_status_fin,
          'ordem_servico',
          NEW.id
        );

        UPDATE public.ordens_servico
           SET financeiro_gerado_em = now()
         WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;

  -- Cobrança por KM: gera conta quando OS for concluída/finalizada
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.modo_cobranca, 'fixo') = 'km'
     AND lower(COALESCE(NEW.status, '')) IN ('concluida', 'finalizada')
     AND lower(COALESCE(OLD.status, '')) NOT IN ('concluida', 'finalizada') THEN

    SELECT id INTO v_existing
    FROM public.contas_financeiras
    WHERE os_id = NEW.id
    LIMIT 1;

    IF v_existing IS NULL THEN
      v_km_inicio := COALESCE(NEW.km_inicio, NEW.km_inicial, 0);
      v_km_fim := COALESCE(NEW.km_fim, NEW.km_final, 0);
      v_valor := GREATEST(v_km_fim - v_km_inicio, 0) * COALESCE(NEW.valor_km, 0);

      IF v_valor > 0 THEN
        INSERT INTO public.contas_financeiras (
          empresa_id,
          descricao,
          tipo,
          valor,
          data_vencimento,
          status,
          categoria,
          os_id
        ) VALUES (
          NEW.empresa_id,
          'Receita por KM ' || v_os_numero,
          'receber',
          v_valor,
          COALESCE((NEW.fim_em AT TIME ZONE 'UTC')::date, CURRENT_DATE),
          'pendente',
          'ordem_servico',
          NEW.id
        );

        UPDATE public.ordens_servico
           SET valor_total = v_valor,
               status_pagamento = COALESCE(status_pagamento, 'pendente'),
               financeiro_gerado_em = now()
         WHERE id = NEW.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_os_sync_financeiro_km_fixo_insert
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.os_sync_financeiro_km_fixo();

CREATE TRIGGER trg_os_sync_financeiro_km_fixo_update
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.os_sync_financeiro_km_fixo();
