-- RPCs de apoio para o módulo WhatsApp (empresa)

CREATE OR REPLACE FUNCTION public.whatsapp_save_config(
  p_provider text DEFAULT 'custom_webhook',
  p_ativo boolean DEFAULT false,
  p_from_number text DEFAULT NULL,
  p_api_url text DEFAULT NULL,
  p_api_token text DEFAULT NULL,
  p_instance_key text DEFAULT NULL,
  p_webhook_secret text DEFAULT NULL,
  p_default_country_code text DEFAULT '55'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  INSERT INTO public.whatsapp_configs (
    empresa_id,
    provider,
    ativo,
    from_number,
    api_url,
    api_token,
    instance_key,
    webhook_secret,
    default_country_code
  ) VALUES (
    v_empresa_id,
    COALESCE(NULLIF(btrim(p_provider), ''), 'custom_webhook'),
    COALESCE(p_ativo, false),
    NULLIF(btrim(COALESCE(p_from_number, '')), ''),
    NULLIF(btrim(COALESCE(p_api_url, '')), ''),
    CASE
      WHEN p_api_token IS NULL OR btrim(p_api_token) = '' THEN NULL
      ELSE btrim(p_api_token)
    END,
    NULLIF(btrim(COALESCE(p_instance_key, '')), ''),
    NULLIF(btrim(COALESCE(p_webhook_secret, '')), ''),
    COALESCE(NULLIF(btrim(p_default_country_code), ''), '55')
  )
  ON CONFLICT (empresa_id)
  DO UPDATE SET
    provider = EXCLUDED.provider,
    ativo = EXCLUDED.ativo,
    from_number = EXCLUDED.from_number,
    api_url = EXCLUDED.api_url,
    api_token = COALESCE(EXCLUDED.api_token, whatsapp_configs.api_token),
    instance_key = EXCLUDED.instance_key,
    webhook_secret = EXCLUDED.webhook_secret,
    default_country_code = EXCLUDED.default_country_code,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_save_template(
  p_id uuid DEFAULT NULL,
  p_codigo text DEFAULT NULL,
  p_categoria text DEFAULT 'sistema',
  p_titulo text DEFAULT NULL,
  p_template text DEFAULT NULL,
  p_variaveis jsonb DEFAULT '[]'::jsonb,
  p_ativo boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF p_id IS NULL THEN
    IF COALESCE(btrim(COALESCE(p_codigo, '')), '') = '' THEN
      RAISE EXCEPTION 'codigo_required';
    END IF;
    IF COALESCE(btrim(COALESCE(p_template, '')), '') = '' THEN
      RAISE EXCEPTION 'template_required';
    END IF;

    INSERT INTO public.whatsapp_templates (
      empresa_id,
      codigo,
      categoria,
      titulo,
      template,
      variaveis,
      ativo,
      created_by
    ) VALUES (
      v_empresa_id,
      btrim(p_codigo),
      COALESCE(NULLIF(btrim(p_categoria), ''), 'sistema'),
      NULLIF(btrim(COALESCE(p_titulo, '')), ''),
      btrim(p_template),
      COALESCE(p_variaveis, '[]'::jsonb),
      COALESCE(p_ativo, true),
      auth.uid()
    )
    ON CONFLICT (empresa_id, codigo)
    DO UPDATE SET
      categoria = EXCLUDED.categoria,
      titulo = EXCLUDED.titulo,
      template = EXCLUDED.template,
      variaveis = EXCLUDED.variaveis,
      ativo = EXCLUDED.ativo,
      updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.whatsapp_templates
    SET
      codigo = COALESCE(NULLIF(btrim(p_codigo), ''), codigo),
      categoria = COALESCE(NULLIF(btrim(p_categoria), ''), categoria),
      titulo = COALESCE(NULLIF(btrim(COALESCE(p_titulo, '')), ''), titulo),
      template = COALESCE(NULLIF(btrim(COALESCE(p_template, '')), ''), template),
      variaveis = COALESCE(p_variaveis, variaveis),
      ativo = COALESCE(p_ativo, ativo),
      updated_at = now()
    WHERE id = p_id
      AND empresa_id = v_empresa_id
    RETURNING id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'template_not_found';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_delete_template(
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  DELETE FROM public.whatsapp_templates
  WHERE id = p_id
    AND empresa_id = v_empresa_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_retry_outbox(
  p_outbox_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  UPDATE public.whatsapp_outbox
  SET
    status = 'queued',
    next_retry_at = null,
    last_error = null,
    updated_at = now()
  WHERE id = p_outbox_id
    AND empresa_id = v_empresa_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_cancel_outbox(
  p_outbox_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  UPDATE public.whatsapp_outbox
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_outbox_id
    AND empresa_id = v_empresa_id
    AND status IN ('queued', 'failed', 'sending');

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_enqueue_test(
  p_destino_numero text,
  p_mensagem text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.whatsapp_enqueue(
    p_destino_numero := p_destino_numero,
    p_destino_nome := 'Teste WhatsApp',
    p_mensagem := p_mensagem,
    p_template_codigo := 'manual_test',
    p_payload := jsonb_build_object('kind', 'manual_test'),
    p_prioridade := 6,
    p_source_type := 'manual_test',
    p_source_id := null,
    p_scheduled_for := null
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
