-- Fundação da integração WhatsApp (configuração, templates, fila de envio e gatilhos iniciais)

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE TABLE IF NOT EXISTS public.whatsapp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'custom_webhook'
    CHECK (provider IN ('custom_webhook', 'zapi', 'twilio', '360dialog', 'evolution')),
  ativo boolean NOT NULL DEFAULT false,
  from_number text,
  api_url text,
  api_token text,
  instance_key text,
  webhook_secret text,
  default_country_code text NOT NULL DEFAULT '55',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  categoria text NOT NULL DEFAULT 'sistema'
    CHECK (categoria IN ('os', 'suporte', 'financeiro', 'marketing', 'sistema')),
  titulo text,
  template text NOT NULL,
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  destino_nome text,
  destino_numero text NOT NULL,
  mensagem text,
  template_codigo text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  prioridade int NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  next_retry_at timestamptz,
  provider_message_id text,
  source_type text,
  source_id uuid,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.whatsapp_outbox(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  attempt int NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  http_status int,
  response_body text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_status_next
  ON public.whatsapp_outbox(status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_empresa_created
  ON public.whatsapp_outbox(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_outbox
  ON public.whatsapp_dispatch_logs(outbox_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at_whatsapp_generic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_configs_updated_at ON public.whatsapp_configs;
CREATE TRIGGER trg_whatsapp_configs_updated_at
  BEFORE UPDATE ON public.whatsapp_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_whatsapp_generic();

DROP TRIGGER IF EXISTS trg_whatsapp_templates_updated_at ON public.whatsapp_templates;
CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_whatsapp_generic();

DROP TRIGGER IF EXISTS trg_whatsapp_outbox_updated_at ON public.whatsapp_outbox;
CREATE TRIGGER trg_whatsapp_outbox_updated_at
  BEFORE UPDATE ON public.whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_whatsapp_generic();

ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_dispatch_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_configs_empresa_select ON public.whatsapp_configs;
CREATE POLICY whatsapp_configs_empresa_select
  ON public.whatsapp_configs
  FOR SELECT
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_configs_empresa_upsert ON public.whatsapp_configs;
CREATE POLICY whatsapp_configs_empresa_upsert
  ON public.whatsapp_configs
  FOR ALL
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_templates_empresa_select ON public.whatsapp_templates;
CREATE POLICY whatsapp_templates_empresa_select
  ON public.whatsapp_templates
  FOR SELECT
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_templates_empresa_upsert ON public.whatsapp_templates;
CREATE POLICY whatsapp_templates_empresa_upsert
  ON public.whatsapp_templates
  FOR ALL
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_outbox_empresa_select ON public.whatsapp_outbox;
CREATE POLICY whatsapp_outbox_empresa_select
  ON public.whatsapp_outbox
  FOR SELECT
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_outbox_insert ON public.whatsapp_outbox;
CREATE POLICY whatsapp_outbox_insert
  ON public.whatsapp_outbox
  FOR INSERT
  WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_outbox_update ON public.whatsapp_outbox;
CREATE POLICY whatsapp_outbox_update
  ON public.whatsapp_outbox
  FOR UPDATE
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_logs_empresa_select ON public.whatsapp_dispatch_logs;
CREATE POLICY whatsapp_logs_empresa_select
  ON public.whatsapp_dispatch_logs
  FOR SELECT
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_logs_insert_service ON public.whatsapp_dispatch_logs;
CREATE POLICY whatsapp_logs_insert_service
  ON public.whatsapp_dispatch_logs
  FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_number(
  p_number text,
  p_default_country text DEFAULT '55'
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_clean text;
BEGIN
  v_clean := regexp_replace(COALESCE(p_number, ''), '\D', '', 'g');

  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  IF left(v_clean, 2) <> COALESCE(NULLIF(p_default_country, ''), '55') THEN
    v_clean := COALESCE(NULLIF(p_default_country, ''), '55') || v_clean;
  END IF;

  RETURN v_clean;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_enqueue(
  p_destino_numero text,
  p_destino_nome text DEFAULT NULL,
  p_mensagem text DEFAULT NULL,
  p_template_codigo text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_prioridade int DEFAULT 5,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL,
  p_scheduled_for timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_config public.whatsapp_configs;
  v_id uuid;
  v_numero text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT * INTO v_config
  FROM public.whatsapp_configs
  WHERE empresa_id = v_empresa_id;

  IF v_config.id IS NULL OR COALESCE(v_config.ativo, false) = false THEN
    RAISE EXCEPTION 'whatsapp_not_configured';
  END IF;

  v_numero := public.normalize_whatsapp_number(p_destino_numero, v_config.default_country_code);
  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'invalid_phone';
  END IF;

  INSERT INTO public.whatsapp_outbox (
    empresa_id,
    destino_nome,
    destino_numero,
    mensagem,
    template_codigo,
    payload,
    prioridade,
    status,
    source_type,
    source_id,
    scheduled_for
  ) VALUES (
    v_empresa_id,
    NULLIF(btrim(COALESCE(p_destino_nome, '')), ''),
    v_numero,
    NULLIF(btrim(COALESCE(p_mensagem, '')), ''),
    NULLIF(btrim(COALESCE(p_template_codigo, '')), ''),
    COALESCE(p_payload, '{}'::jsonb),
    GREATEST(1, LEAST(COALESCE(p_prioridade, 5), 10)),
    'queued',
    NULLIF(btrim(COALESCE(p_source_type, '')), ''),
    p_source_id,
    p_scheduled_for
  ) RETURNING id INTO v_id;

  RETURN v_id;
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
    'Você recebeu uma resposta no ticket de suporte. Acesse o painel para visualizar os detalhes.',
    'support_reply',
    jsonb_build_object('ticket_id', NEW.ticket_id, 'message_id', NEW.id),
    8,
    'queued',
    'support',
    NEW.ticket_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_support_master_reply ON public.support_messages;
CREATE TRIGGER trg_whatsapp_support_master_reply
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_whatsapp_support_on_master_reply();

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_os_event_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_config public.whatsapp_configs;
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

  v_text := format(
    'Alerta operacional (%s): %s',
    upper(NEW.severidade),
    COALESCE(NULLIF(NEW.mensagem, ''), NEW.evento)
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
    jsonb_build_object('os_evento_id', NEW.id, 'os_id', NEW.ordem_servico_id, 'evento', NEW.evento),
    CASE WHEN NEW.severidade = 'critical' THEN 10 ELSE 7 END,
    'queued',
    'os_evento',
    NEW.ordem_servico_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_os_event_alert ON public.os_eventos;
CREATE TRIGGER trg_whatsapp_os_event_alert
  AFTER INSERT ON public.os_eventos
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_whatsapp_os_event_alert();

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
    (
      'support_reply',
      'suporte',
      'Resposta no suporte',
      'Você recebeu uma nova resposta no ticket {{ticket_id}}. Acesse o painel para ver detalhes.',
      '["ticket_id"]'::jsonb
    ),
    (
      'os_alert',
      'os',
      'Alerta operacional',
      'Alerta na OS {{os_id}}: {{mensagem}}',
      '["os_id", "mensagem"]'::jsonb
    )
) AS t(codigo, categoria, titulo, template, variaveis)
ON CONFLICT (empresa_id, codigo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
