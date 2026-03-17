-- Fretamento eventual: suporte a sinal no financeiro e tipo de extra do motorista

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS extra_motorista_tipo text
    CHECK (extra_motorista_tipo IN ('fixo', 'hora')),
  ADD COLUMN IF NOT EXISTS valor_hora_extra_motorista numeric,
  ADD COLUMN IF NOT EXISTS qtd_horas_extra_motorista numeric;

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
  v_valor_sinal numeric;
  v_valor_saldo numeric;
  v_existing uuid;
  v_km_inicio numeric;
  v_km_fim numeric;
BEGIN
  v_os_numero := COALESCE('OS-' || LPAD(COALESCE(NEW.numero, 0)::text, 4, '0'), 'OS');
  v_data_base := COALESCE((NEW.inicio_em AT TIME ZONE 'UTC')::date, CURRENT_DATE);

  -- Cobrança fixa: gera financeiro no momento da criação da OS
  IF TG_OP = 'INSERT' AND COALESCE(NEW.modo_cobranca, 'fixo') = 'fixo' THEN
    v_valor := COALESCE(NEW.valor_fixo, NEW.valor_total, 0);
    IF v_valor > 0 THEN
      SELECT id INTO v_existing
      FROM public.contas_financeiras
      WHERE os_id = NEW.id
      LIMIT 1;

      IF v_existing IS NULL THEN
        v_valor_sinal := LEAST(GREATEST(COALESCE(NEW.valor_sinal, 0), 0), v_valor);
        v_valor_saldo := GREATEST(v_valor - v_valor_sinal, 0);

        -- Se recebeu sinal, já entra como recebido no caixa
        IF v_valor_sinal > 0 THEN
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
            'Sinal ' || v_os_numero,
            'receber',
            v_valor_sinal,
            v_data_base,
            CURRENT_DATE,
            'recebido',
            'ordem_servico',
            NEW.id
          );
        END IF;

        -- Saldo a receber, conforme status informado
        IF v_valor_saldo > 0 THEN
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
            CASE WHEN v_valor_sinal > 0 THEN 'Saldo ' || v_os_numero ELSE 'Receita ' || v_os_numero END,
            'receber',
            v_valor_saldo,
            v_data_base,
            CASE WHEN v_status_fin = 'recebido' THEN CURRENT_DATE ELSE NULL END,
            v_status_fin,
            'ordem_servico',
            NEW.id
          );
        END IF;

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
  IF lower(COALESCE(NEW.status, '')) NOT IN ('concluida', 'finalizada') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.pagar_extra_motorista, false) = false THEN
    RETURN NEW;
  END IF;

  IF NEW.motorista_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_valor := CASE
    WHEN COALESCE(NEW.extra_motorista_tipo, 'fixo') = 'hora'
      THEN COALESCE(NEW.valor_hora_extra_motorista, 0) * GREATEST(COALESCE(NEW.qtd_horas_extra_motorista, 0), 0)
    ELSE COALESCE(NEW.valor_extra_motorista, 0)
  END;

  IF v_valor <= 0 THEN
    RETURN NEW;
  END IF;

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
