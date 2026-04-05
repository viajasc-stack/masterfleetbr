-- Notificações motorista: garantir alvo correto e regra de data para nova OS.
-- 1) Nova OS só gera notificação quando for para o dia atual (America/Sao_Paulo)
-- 2) Push é enfileirado apenas para o motorista alvo quando meta.motorista_id estiver presente

CREATE OR REPLACE FUNCTION public.enqueue_notification_on_os_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_date_sp date;
  v_today_sp date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  -- Sem motorista atribuído, sem notificação para app motorista
  IF NEW.motorista_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Nova OS notifica somente quando a operação for para o dia atual
  v_os_date_sp := (NEW.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date;
  IF v_os_date_sp IS DISTINCT FROM v_today_sp THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    empresa_id,
    nivel,
    titulo,
    mensagem,
    meta
  ) VALUES (
    NEW.empresa_id,
    'info',
    'Nova OS atribuída',
    format('OS #%s criada para operação.', COALESCE(NEW.numero::text, NEW.id::text)),
    jsonb_build_object(
      'tipo', 'nova_os',
      'ordem_servico_id', NEW.id,
      'os_numero', NEW.numero,
      'status', NEW.status,
      'motorista_id', NEW.motorista_id
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_motorista_push_from_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text := COALESCE(NEW.meta->>'tipo', '');
  v_target_motorista_id uuid := NULL;
BEGIN
  IF COALESCE(NEW.meta->>'motorista_id', '') <> '' THEN
    BEGIN
      v_target_motorista_id := (NEW.meta->>'motorista_id')::uuid;
    EXCEPTION WHEN others THEN
      v_target_motorista_id := NULL;
    END;
  END IF;

  INSERT INTO public.motorista_push_outbox (
    empresa_id,
    notification_id,
    motorista_id,
    expo_push_token,
    titulo,
    mensagem,
    payload,
    status,
    attempts,
    next_retry_at
  )
  SELECT
    NEW.empresa_id,
    NEW.id,
    m.id,
    t.expo_push_token,
    NEW.titulo,
    COALESCE(NEW.mensagem, ''),
    jsonb_build_object(
      'notification_id', NEW.id,
      'nivel', NEW.nivel,
      'tipo', v_tipo,
      'meta', COALESCE(NEW.meta, '{}'::jsonb)
    ),
    'queued',
    0,
    now()
  FROM public.motoristas m
  INNER JOIN public.motorista_push_tokens t
    ON t.motorista_id = m.id
   AND t.empresa_id = NEW.empresa_id
   AND COALESCE(t.ativo, true) = true
  LEFT JOIN public.motorista_notificacao_preferencias p
    ON p.motorista_id = m.id
  WHERE m.empresa_id = NEW.empresa_id
    AND (v_target_motorista_id IS NULL OR m.id = v_target_motorista_id)
    AND public.should_send_motorista_notification(
      v_tipo,
      NEW.nivel,
      p.nova_os,
      p.alteracao_os,
      p.manutencao,
      p.abastecimento,
      p.mensagens,
      p.alertas_sistema
    );

  RETURN NEW;
END;
$$;
