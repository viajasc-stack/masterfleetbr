-- Notificações motorista (push):
-- 1) Nova OS: notificar somente quando inicio_em for da data atual (America/Sao_Paulo);
-- 2) OS editada: notificar somente quando inicio_em for da data atual (America/Sao_Paulo)
--    e houver motorista atribuído.

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
  IF NEW.motorista_id IS NULL THEN
    RETURN NEW;
  END IF;

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
      'motorista_id', NEW.motorista_id,
      'inicio_em', NEW.inicio_em
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_notification_on_os_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
  v_today_sp date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_os_date_sp date;
  v_nivel text := 'info';
  v_titulo text := 'Alteração de OS';
  v_msg text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.motorista_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notifica edição apenas quando a OS for da data atual em São Paulo.
  v_os_date_sp := (NEW.inicio_em AT TIME ZONE 'America/Sao_Paulo')::date;
  IF v_os_date_sp IS DISTINCT FROM v_today_sp THEN
    RETURN NEW;
  END IF;

  IF v_new_status = 'cancelada' THEN
    v_nivel := 'warning';
  END IF;

  IF OLD.motorista_id IS DISTINCT FROM NEW.motorista_id THEN
    v_msg := format(
      'OS #%s foi reatribuída para este motorista.',
      COALESCE(NEW.numero::text, NEW.id::text)
    );
  ELSIF OLD.inicio_em IS DISTINCT FROM NEW.inicio_em THEN
    v_msg := format(
      'OS #%s teve horário/data de início atualizado.',
      COALESCE(NEW.numero::text, NEW.id::text)
    );
  ELSIF v_old_status IS DISTINCT FROM v_new_status THEN
    v_msg := format(
      'OS #%s mudou de %s para %s.',
      COALESCE(NEW.numero::text, NEW.id::text),
      COALESCE(NULLIF(OLD.status, ''), '—'),
      COALESCE(NULLIF(NEW.status, ''), '—')
    );
  ELSE
    v_msg := format(
      'OS #%s recebeu atualização operacional.',
      COALESCE(NEW.numero::text, NEW.id::text)
    );
  END IF;

  INSERT INTO public.notifications (
    empresa_id,
    nivel,
    titulo,
    mensagem,
    meta
  ) VALUES (
    NEW.empresa_id,
    v_nivel,
    v_titulo,
    v_msg,
    jsonb_build_object(
      'tipo', 'alteracao_os',
      'ordem_servico_id', NEW.id,
      'os_numero', NEW.numero,
      'status_from', OLD.status,
      'status_to', NEW.status,
      'motorista_id', NEW.motorista_id,
      'inicio_em', NEW.inicio_em
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_os_status_change ON public.ordens_servico;

DROP TRIGGER IF EXISTS trg_notifications_os_update ON public.ordens_servico;
CREATE TRIGGER trg_notifications_os_update
  AFTER UPDATE OF status, motorista_id, inicio_em, fim_em, veiculo_id, origem, destino, local_saida, local_chegada, roteiro, observacoes
  ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notification_on_os_update();
