-- Fase 3.1 complemento:
-- Gera notificações internas para eventos de OS (nova e alteração de status),
-- permitindo dispatch push automático via trigger já existente em notifications.

CREATE OR REPLACE FUNCTION public.enqueue_notification_on_os_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notificação base de nova OS para a empresa (filtrável por preferências do motorista)
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

CREATE OR REPLACE FUNCTION public.enqueue_notification_on_os_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
  v_nivel text := 'info';
  v_titulo text;
  v_msg text;
BEGIN
  IF TG_OP <> 'UPDATE' OR v_old_status = v_new_status THEN
    RETURN NEW;
  END IF;

  IF v_new_status = 'cancelada' THEN
    v_nivel := 'warning';
  ELSIF v_new_status IN ('concluida', 'finalizada') THEN
    v_nivel := 'info';
  ELSIF v_new_status IN ('em_execucao', 'em_andamento') THEN
    v_nivel := 'info';
  END IF;

  v_titulo := 'Alteração de OS';
  v_msg := format(
    'OS #%s mudou de %s para %s.',
    COALESCE(NEW.numero::text, NEW.id::text),
    COALESCE(NULLIF(OLD.status, ''), '—'),
    COALESCE(NULLIF(NEW.status, ''), '—')
  );

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
      'motorista_id', NEW.motorista_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_os_insert ON public.ordens_servico;
CREATE TRIGGER trg_notifications_os_insert
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notification_on_os_insert();

DROP TRIGGER IF EXISTS trg_notifications_os_status_change ON public.ordens_servico;
CREATE TRIGGER trg_notifications_os_status_change
  AFTER UPDATE OF status ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_notification_on_os_status_change();
