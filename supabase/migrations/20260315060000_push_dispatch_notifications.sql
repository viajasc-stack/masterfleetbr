-- Fase 3.1 (push fim-a-fim):
-- 1) outbox de push por motorista
-- 2) trigger de evento em notifications para enfileirar envios respeitando preferências

CREATE TABLE IF NOT EXISTS public.motorista_push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  expo_push_token text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  payload jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 6,
  next_retry_at timestamptz,
  provider_ticket_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_motorista_push_outbox_status_retry
  ON public.motorista_push_outbox(status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_motorista_push_outbox_empresa
  ON public.motorista_push_outbox(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_motorista_push_outbox_notification
  ON public.motorista_push_outbox(notification_id);

ALTER TABLE public.motorista_push_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motorista_push_outbox_empresa" ON public.motorista_push_outbox;
CREATE POLICY "motorista_push_outbox_empresa"
ON public.motorista_push_outbox
USING (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS "motorista_push_outbox_insert" ON public.motorista_push_outbox;
CREATE POLICY "motorista_push_outbox_insert"
ON public.motorista_push_outbox
FOR INSERT
WITH CHECK (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS "motorista_push_outbox_update" ON public.motorista_push_outbox;
CREATE POLICY "motorista_push_outbox_update"
ON public.motorista_push_outbox
FOR UPDATE
USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_updated_at_motorista_push_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_motorista_push_outbox_updated_at ON public.motorista_push_outbox;
CREATE TRIGGER trg_motorista_push_outbox_updated_at
  BEFORE INSERT OR UPDATE ON public.motorista_push_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_motorista_push_outbox();

CREATE OR REPLACE FUNCTION public.should_send_motorista_notification(
  p_tipo text,
  p_nivel text,
  p_nova_os boolean,
  p_alteracao_os boolean,
  p_manutencao boolean,
  p_abastecimento boolean,
  p_mensagens boolean,
  p_alertas_sistema boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE(lower(p_nivel), '') = 'critical' THEN
    RETURN true;
  END IF;

  CASE COALESCE(p_tipo, '')
    WHEN 'nova_os' THEN RETURN COALESCE(p_nova_os, true);
    WHEN 'alteracao_os' THEN RETURN COALESCE(p_alteracao_os, true);
    WHEN 'manutencao' THEN RETURN COALESCE(p_manutencao, true);
    WHEN 'abastecimento' THEN RETURN COALESCE(p_abastecimento, true);
    WHEN 'mensagens' THEN RETURN COALESCE(p_mensagens, true);
    WHEN 'alertas_sistema' THEN RETURN COALESCE(p_alertas_sistema, true);
    ELSE
      -- Tipos não mapeados: mantém envio por padrão
      RETURN true;
  END CASE;
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
BEGIN
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

DROP TRIGGER IF EXISTS trg_notifications_enqueue_motorista_push ON public.notifications;
CREATE TRIGGER trg_notifications_enqueue_motorista_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_motorista_push_from_notification();
