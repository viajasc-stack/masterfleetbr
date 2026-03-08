-- WhatsApp: automações operacionais adicionais + status de entrega/leitura

ALTER TABLE public.whatsapp_outbox
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_event_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.whatsapp_render_template(
  p_empresa_id uuid,
  p_codigo text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_fallback text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template text;
  v_text text;
  v_key text;
  v_val text;
BEGIN
  SELECT t.template
    INTO v_template
    FROM public.whatsapp_templates t
   WHERE t.empresa_id = p_empresa_id
     AND t.codigo = p_codigo
     AND t.ativo = true
   LIMIT 1;

  v_text := COALESCE(v_template, p_fallback);
  IF v_text IS NULL THEN
    RETURN NULL;
  END IF;

  FOR v_key, v_val IN
    SELECT key, value
    FROM jsonb_each_text(COALESCE(p_payload, '{}'::jsonb))
  LOOP
    v_text := replace(v_text, '{{' || v_key || '}}', COALESCE(v_val, ''));
  END LOOP;

  RETURN v_text;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_support_on_master_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_config public.whatsapp_configs;
  v_payload jsonb;
  v_msg text;
BEGIN
  IF NEW.autor_tipo <> 'master' OR COALESCE(NEW.interna, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT e.whatsapp INTO v_phone
  FROM public.empresas e
  WHERE e.id = NEW.empresa_id;

  IF COALESCE(btrim(COALESCE(v_phone, '')), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_config
  FROM public.whatsapp_configs
  WHERE empresa_id = NEW.empresa_id;

  IF v_config.id IS NULL OR COALESCE(v_config.ativo, false) = false THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'ticket_id', NEW.ticket_id,
    'message_id', NEW.id
  );

  v_msg := public.whatsapp_render_template(
    NEW.empresa_id,
    'support_reply',
    v_payload,
    'Você recebeu uma resposta no ticket {{ticket_id}}. Acesse o painel para visualizar os detalhes.'
  );

  INSERT INTO public.whatsapp_outbox (
    empresa_id,
    destino_numero,
    mensagem,
    template_codigo,
    payload,
    prioridade,
    status,
    source_type,
    source_id
  ) VALUES (
    NEW.empresa_id,
    public.normalize_whatsapp_number(v_phone, v_config.default_country_code),
    v_msg,
    'support_reply',
    v_payload,
    8,
    'queued',
    'support',
    NEW.ticket_id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_os_event_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_config public.whatsapp_configs;
  v_payload jsonb;
  v_text text;
BEGIN
  IF NEW.severidade NOT IN ('warning', 'critical') THEN
    RETURN NEW;
  END IF;

  SELECT e.whatsapp INTO v_phone
  FROM public.empresas e
  WHERE e.id = NEW.empresa_id;

  IF COALESCE(btrim(COALESCE(v_phone, '')), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_config
  FROM public.whatsapp_configs
  WHERE empresa_id = NEW.empresa_id;

  IF v_config.id IS NULL OR COALESCE(v_config.ativo, false) = false THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'os_evento_id', NEW.id,
    'os_id', NEW.ordem_servico_id,
    'evento', NEW.evento,
    'mensagem', COALESCE(NULLIF(NEW.mensagem, ''), NEW.evento),
    'severidade', NEW.severidade
  );

  v_text := public.whatsapp_render_template(
    NEW.empresa_id,
    'os_alert',
    v_payload,
    format('Alerta operacional (%s): %s', upper(NEW.severidade), COALESCE(NULLIF(NEW.mensagem, ''), NEW.evento))
  );

  INSERT INTO public.whatsapp_outbox (
    empresa_id,
    destino_numero,
    mensagem,
    template_codigo,
    payload,
    prioridade,
    status,
    source_type,
    source_id
  ) VALUES (
    NEW.empresa_id,
    public.normalize_whatsapp_number(v_phone, v_config.default_country_code),
    v_text,
    'os_alert',
    v_payload,
    CASE WHEN NEW.severidade = 'critical' THEN 10 ELSE 7 END,
    'queued',
    'os_evento',
    NEW.ordem_servico_id
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_os_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_config public.whatsapp_configs;
  v_template text;
  v_payload jsonb;
  v_msg text;
  v_prio int := 7;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'em_execucao' THEN
    v_template := 'os_started';
    v_prio := 7;
  ELSIF NEW.status IN ('concluida', 'finalizada') THEN
    v_template := 'os_completed';
    v_prio := 8;
  ELSIF NEW.status = 'cancelada' THEN
    v_template := 'os_cancelled';
    v_prio := 6;
  ELSE
    RETURN NEW;
  END IF;

  SELECT e.whatsapp INTO v_phone
  FROM public.empresas e
  WHERE e.id = NEW.empresa_id;

  IF COALESCE(btrim(COALESCE(v_phone, '')), '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_config
  FROM public.whatsapp_configs
  WHERE empresa_id = NEW.empresa_id;

  IF v_config.id IS NULL OR COALESCE(v_config.ativo, false) = false THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'os_id', NEW.id,
    'os_numero', NEW.numero,
    'status', NEW.status,
    'origem', COALESCE(NEW.origem, ''),
    'destino', COALESCE(NEW.destino, '')
  );

  v_msg := public.whatsapp_render_template(
    NEW.empresa_id,
    v_template,
    v_payload,
    CASE
      WHEN v_template = 'os_started' THEN format('OS #%s iniciada.', COALESCE(NEW.numero::text, NEW.id::text))
      WHEN v_template = 'os_completed' THEN format('OS #%s concluída.', COALESCE(NEW.numero::text, NEW.id::text))
      ELSE format('OS #%s cancelada.', COALESCE(NEW.numero::text, NEW.id::text))
    END
  );

  INSERT INTO public.whatsapp_outbox (
    empresa_id,
    destino_numero,
    mensagem,
    template_codigo,
    payload,
    prioridade,
    status,
    source_type,
    source_id
  ) VALUES (
    NEW.empresa_id,
    public.normalize_whatsapp_number(v_phone, v_config.default_country_code),
    v_msg,
    v_template,
    v_payload,
    v_prio,
    'queued',
    'ordem_servico_status',
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_os_status_change ON public.ordens_servico;
CREATE TRIGGER trg_whatsapp_os_status_change
  AFTER UPDATE OF status ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_whatsapp_os_status_change();

CREATE OR REPLACE FUNCTION public.whatsapp_apply_delivery_event(
  p_empresa_id uuid,
  p_provider text,
  p_message_id text DEFAULT NULL,
  p_outbox_id uuid DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text := lower(COALESCE(p_event_type, ''));
  v_outbox_id uuid;
  v_err text;
BEGIN
  SELECT o.id
    INTO v_outbox_id
    FROM public.whatsapp_outbox o
   WHERE o.empresa_id = p_empresa_id
     AND (
       (p_outbox_id IS NOT NULL AND o.id = p_outbox_id)
       OR
       (COALESCE(p_message_id, '') <> '' AND o.provider_message_id = p_message_id)
     )
   ORDER BY o.created_at DESC
   LIMIT 1;

  IF v_outbox_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_event IN ('delivered', 'delivery', 'message_delivered') THEN
    UPDATE public.whatsapp_outbox
       SET provider_status = 'delivered',
           delivered_at = COALESCE(delivered_at, now()),
           provider_event_payload = COALESCE(p_payload, '{}'::jsonb),
           updated_at = now()
     WHERE id = v_outbox_id;
  ELSIF v_event IN ('read', 'seen', 'message_read') THEN
    UPDATE public.whatsapp_outbox
       SET provider_status = 'read',
           delivered_at = COALESCE(delivered_at, now()),
           read_at = COALESCE(read_at, now()),
           provider_event_payload = COALESCE(p_payload, '{}'::jsonb),
           updated_at = now()
     WHERE id = v_outbox_id;
  ELSIF v_event IN ('failed', 'undelivered', 'error') THEN
    v_err := NULLIF(COALESCE(p_payload->>'error', p_payload->>'message', p_payload->>'detail', ''), '');
    UPDATE public.whatsapp_outbox
       SET status = 'failed',
           provider_status = 'failed',
           last_error = COALESCE(v_err, last_error),
           provider_event_payload = COALESCE(p_payload, '{}'::jsonb),
           updated_at = now()
     WHERE id = v_outbox_id;
  ELSE
    UPDATE public.whatsapp_outbox
       SET provider_status = NULLIF(v_event, ''),
           provider_event_payload = COALESCE(p_payload, '{}'::jsonb),
           updated_at = now()
     WHERE id = v_outbox_id;
  END IF;

  INSERT INTO public.whatsapp_dispatch_logs (
    outbox_id,
    empresa_id,
    attempt,
    status,
    response_body,
    error_message
  )
  SELECT
    v_outbox_id,
    p_empresa_id,
    0,
    CASE WHEN v_event IN ('failed', 'undelivered', 'error') THEN 'error' ELSE 'success' END,
    COALESCE(p_payload, '{}'::jsonb)::text,
    CASE WHEN v_event IN ('failed', 'undelivered', 'error') THEN COALESCE(v_err, 'provider_delivery_event_error') ELSE NULL END;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.whatsapp_render_template(uuid, text, jsonb, text) TO authenticated;

INSERT INTO public.whatsapp_templates (
  empresa_id,
  codigo,
  categoria,
  titulo,
  template,
  variaveis,
  created_by
)
SELECT
  e.id,
  t.codigo,
  t.categoria,
  t.titulo,
  t.template,
  t.variaveis,
  NULL
FROM public.empresas e
CROSS JOIN (
  VALUES
    ('os_started', 'os', 'OS iniciada', 'OS #{{os_numero}} iniciada. Origem: {{origem}} • Destino: {{destino}}', '["os_numero", "origem", "destino"]'::jsonb),
    ('os_completed', 'os', 'OS concluída', 'OS #{{os_numero}} concluída com sucesso.', '["os_numero"]'::jsonb),
    ('os_cancelled', 'os', 'OS cancelada', 'OS #{{os_numero}} foi cancelada.', '["os_numero"]'::jsonb)
) AS t(codigo, categoria, titulo, template, variaveis)
ON CONFLICT (empresa_id, codigo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
