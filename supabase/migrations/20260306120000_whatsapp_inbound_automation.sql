-- WhatsApp inbound: captura de webhook e automação de suporte

CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'custom_webhook',
  event_type text NOT NULL DEFAULT 'message',
  from_number text,
  to_number text,
  message_text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processed', 'ignored', 'error')),
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_empresa_created
  ON public.whatsapp_inbound_logs(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_status_created
  ON public.whatsapp_inbound_logs(processing_status, created_at DESC);

ALTER TABLE public.whatsapp_inbound_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_inbound_select_empresa ON public.whatsapp_inbound_logs;
CREATE POLICY whatsapp_inbound_select_empresa
  ON public.whatsapp_inbound_logs
  FOR SELECT
  USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS whatsapp_inbound_insert_service ON public.whatsapp_inbound_logs;
CREATE POLICY whatsapp_inbound_insert_service
  ON public.whatsapp_inbound_logs
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS whatsapp_inbound_update_service ON public.whatsapp_inbound_logs;
CREATE POLICY whatsapp_inbound_update_service
  ON public.whatsapp_inbound_logs
  FOR UPDATE
  USING (public.is_super_admin() OR empresa_id = public.minha_empresa_id())
  WITH CHECK (public.is_super_admin() OR empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.extract_uuid_from_text(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_match text[];
BEGIN
  IF COALESCE(p_text, '') = '' THEN
    RETURN NULL;
  END IF;

  v_match := regexp_match(
    p_text,
    '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'
  );

  IF v_match IS NULL OR array_length(v_match, 1) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN v_match[1]::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_process_inbound(
  p_inbound_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.whatsapp_inbound_logs;
  v_ticket_id uuid;
  v_subject text;
  v_msg text;
  v_result jsonb := '{}'::jsonb;
BEGIN
  SELECT *
    INTO v_row
  FROM public.whatsapp_inbound_logs
  WHERE id = p_inbound_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'inbound_not_found';
  END IF;

  IF v_row.processing_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_row.processing_status, 'already_processed', true);
  END IF;

  IF v_row.empresa_id IS NULL THEN
    UPDATE public.whatsapp_inbound_logs
      SET processing_status = 'ignored',
          processing_error = 'empresa_not_resolved',
          processed_at = now()
    WHERE id = v_row.id;

    RETURN jsonb_build_object('ok', true, 'status', 'ignored', 'reason', 'empresa_not_resolved');
  END IF;

  IF lower(COALESCE(v_row.event_type, 'message')) <> 'message' THEN
    UPDATE public.whatsapp_inbound_logs
      SET processing_status = 'ignored',
          processing_error = 'non_message_event',
          processed_at = now()
    WHERE id = v_row.id;

    RETURN jsonb_build_object('ok', true, 'status', 'ignored', 'reason', 'non_message_event');
  END IF;

  IF COALESCE(btrim(COALESCE(v_row.message_text, '')), '') = '' THEN
    UPDATE public.whatsapp_inbound_logs
      SET processing_status = 'ignored',
          processing_error = 'empty_message',
          processed_at = now()
    WHERE id = v_row.id;

    RETURN jsonb_build_object('ok', true, 'status', 'ignored', 'reason', 'empty_message');
  END IF;

  -- Regra 1: se mensagem contém UUID de ticket existente, responde no ticket
  v_ticket_id := public.extract_uuid_from_text(v_row.message_text);

  IF v_ticket_id IS NOT NULL
     AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = v_ticket_id
        AND t.empresa_id = v_row.empresa_id
     ) THEN
    INSERT INTO public.support_messages (
      ticket_id,
      empresa_id,
      autor_user_id,
      autor_tipo,
      mensagem,
      interna
    ) VALUES (
      v_ticket_id,
      v_row.empresa_id,
      NULL,
      'empresa',
      format('Mensagem recebida via WhatsApp (%s): %s', COALESCE(v_row.from_number, 'sem-numero'), v_row.message_text),
      false
    );

    UPDATE public.whatsapp_inbound_logs
      SET processing_status = 'processed',
          related_ticket_id = v_ticket_id,
          processed_at = now(),
          processing_error = null
    WHERE id = v_row.id;

    RETURN jsonb_build_object(
      'ok', true,
      'status', 'processed',
      'mode', 'append_ticket',
      'ticket_id', v_ticket_id
    );
  END IF;

  -- Regra 2: cria ticket novo quando não houver referência
  v_subject := format('WhatsApp inbound (%s)', COALESCE(v_row.from_number, 'sem-numero'));
  v_msg := format('Mensagem recebida via WhatsApp:%s%s', E'\n\n', v_row.message_text);

  INSERT INTO public.support_tickets (
    empresa_id,
    created_by,
    assunto,
    categoria,
    prioridade,
    status,
    origem
  ) VALUES (
    v_row.empresa_id,
    COALESCE((SELECT user_id FROM public.profiles WHERE empresa_id = v_row.empresa_id ORDER BY role = 'dono' DESC NULLS LAST LIMIT 1), '00000000-0000-0000-0000-000000000000'::uuid),
    v_subject,
    'whatsapp',
    'media',
    'aberto',
    'sistema'
  ) RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_messages (
    ticket_id,
    empresa_id,
    autor_user_id,
    autor_tipo,
    mensagem,
    interna
  ) VALUES (
    v_ticket_id,
    v_row.empresa_id,
    NULL,
    'empresa',
    v_msg,
    false
  );

  UPDATE public.whatsapp_inbound_logs
    SET processing_status = 'processed',
        related_ticket_id = v_ticket_id,
        processed_at = now(),
        processing_error = null
  WHERE id = v_row.id;

  v_result := jsonb_build_object(
    'ok', true,
    'status', 'processed',
    'mode', 'create_ticket',
    'ticket_id', v_ticket_id
  );

  RETURN v_result;
EXCEPTION
  WHEN others THEN
    UPDATE public.whatsapp_inbound_logs
      SET processing_status = 'error',
          processing_error = SQLERRM,
          processed_at = now()
    WHERE id = p_inbound_id;

    RETURN jsonb_build_object('ok', false, 'status', 'error', 'error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
