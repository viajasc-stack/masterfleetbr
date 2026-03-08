-- Suporte: notificações cruzadas, indicador de não lidas e bloqueio de resposta em ticket fechado

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS last_actor_tipo text DEFAULT 'empresa'
    CHECK (last_actor_tipo IN ('empresa', 'master', 'sistema'));

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS empresa_last_read_at timestamptz DEFAULT now();

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS master_last_read_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_support_ticket_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT t.empresa_id
    INTO NEW.empresa_id
  FROM public.support_tickets t
  WHERE t.id = NEW.ticket_id;

  IF NEW.empresa_id IS NULL THEN
    RAISE EXCEPTION 'support_ticket_not_found';
  END IF;

  UPDATE public.support_tickets t
  SET
    last_message_at = now(),
    updated_at = now(),
    first_response_at = CASE
      WHEN NEW.autor_tipo = 'master' AND NEW.interna = false THEN COALESCE(t.first_response_at, now())
      ELSE t.first_response_at
    END,
    status = CASE
      WHEN NEW.autor_tipo = 'master' AND NEW.interna = false AND t.status = 'aberto' THEN 'em_andamento'
      WHEN NEW.autor_tipo = 'empresa' AND t.status IN ('aguardando_cliente', 'resolvido', 'fechado') THEN 'aberto'
      ELSE t.status
    END,
    resolved_at = CASE
      WHEN NEW.autor_tipo = 'empresa' AND t.status IN ('resolvido', 'fechado') THEN NULL
      ELSE t.resolved_at
    END,
    last_actor_tipo = NEW.autor_tipo,
    empresa_last_read_at = CASE WHEN NEW.autor_tipo = 'empresa' THEN now() ELSE t.empresa_last_read_at END,
    master_last_read_at = CASE WHEN NEW.autor_tipo = 'master' THEN now() ELSE t.master_last_read_at END
  WHERE t.id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_messages_sync_ticket ON public.support_messages;
CREATE TRIGGER trg_support_messages_sync_ticket
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_support_ticket_on_message();

CREATE OR REPLACE FUNCTION public.support_add_message(
  p_ticket_id uuid,
  p_mensagem text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_user_id uuid := auth.uid();
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF COALESCE(btrim(p_mensagem), '') = '' THEN
    RAISE EXCEPTION 'mensagem_required';
  END IF;

  SELECT t.status INTO v_status
  FROM public.support_tickets t
  WHERE t.id = p_ticket_id
    AND t.empresa_id = v_empresa_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  IF v_status = 'fechado' THEN
    RAISE EXCEPTION 'ticket_closed';
  END IF;

  INSERT INTO public.support_messages (
    ticket_id,
    empresa_id,
    autor_user_id,
    autor_tipo,
    mensagem,
    interna
  ) VALUES (
    p_ticket_id,
    v_empresa_id,
    v_user_id,
    'empresa',
    btrim(p_mensagem),
    false
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_mark_ticket_read(
  p_ticket_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
  SET empresa_last_read_at = now()
  WHERE id = p_ticket_id
    AND empresa_id = public.minha_empresa_id();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_support_mark_ticket_read(
  p_ticket_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.support_tickets
  SET master_last_read_at = now()
  WHERE id = p_ticket_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_unread_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.support_tickets t
  WHERE t.empresa_id = public.minha_empresa_id()
    AND t.last_actor_tipo = 'master'
    AND COALESCE(t.empresa_last_read_at, to_timestamp(0)) < t.updated_at;
$$;

CREATE OR REPLACE FUNCTION public.master_support_unread_count()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.support_tickets t
  WHERE t.last_actor_tipo = 'empresa'
    AND COALESCE(t.master_last_read_at, to_timestamp(0)) < t.updated_at;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.master_support_reply(
  p_ticket_id uuid,
  p_mensagem text,
  p_interna boolean DEFAULT false,
  p_status text DEFAULT NULL,
  p_prioridade text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF COALESCE(btrim(p_mensagem), '') = '' THEN
    RAISE EXCEPTION 'mensagem_required';
  END IF;

  SELECT t.empresa_id INTO v_empresa_id
  FROM public.support_tickets t
  WHERE t.id = p_ticket_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  INSERT INTO public.support_messages (
    ticket_id,
    empresa_id,
    autor_user_id,
    autor_tipo,
    mensagem,
    interna
  ) VALUES (
    p_ticket_id,
    v_empresa_id,
    v_user_id,
    'master',
    btrim(p_mensagem),
    COALESCE(p_interna, false)
  );

  UPDATE public.support_tickets t
  SET
    status = COALESCE(
      NULLIF(btrim(p_status), ''),
      CASE WHEN COALESCE(p_interna, false) THEN t.status ELSE 'aguardando_cliente' END
    ),
    prioridade = COALESCE(NULLIF(btrim(p_prioridade), ''), t.prioridade),
    first_response_at = CASE
      WHEN COALESCE(p_interna, false) = false THEN COALESCE(t.first_response_at, now())
      ELSE t.first_response_at
    END,
    resolved_at = CASE
      WHEN COALESCE(NULLIF(btrim(p_status), ''), t.status) IN ('resolvido', 'fechado') THEN COALESCE(t.resolved_at, now())
      ELSE NULL
    END,
    last_actor_tipo = 'master',
    master_last_read_at = now(),
    updated_at = now()
  WHERE t.id = p_ticket_id;

  INSERT INTO public.notifications (empresa_id, nivel, titulo, mensagem, meta)
  VALUES (
    v_empresa_id,
    'info',
    'Atualização no suporte',
    CASE
      WHEN COALESCE(p_interna, false) THEN 'Seu ticket recebeu atualização de status.'
      ELSE 'Você recebeu uma resposta no ticket de suporte.'
    END,
    jsonb_build_object('ticket_id', p_ticket_id, 'tipo', 'support_reply')
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_support_set_status(
  p_ticket_id uuid,
  p_status text,
  p_prioridade text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_status NOT IN ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT empresa_id INTO v_empresa_id
  FROM public.support_tickets
  WHERE id = p_ticket_id;

  UPDATE public.support_tickets t
  SET
    status = p_status,
    prioridade = COALESCE(NULLIF(btrim(p_prioridade), ''), t.prioridade),
    resolved_at = CASE
      WHEN p_status IN ('resolvido', 'fechado') THEN COALESCE(t.resolved_at, now())
      ELSE NULL
    END,
    last_actor_tipo = 'master',
    master_last_read_at = now(),
    updated_at = now()
  WHERE t.id = p_ticket_id;

  IF FOUND AND v_empresa_id IS NOT NULL THEN
    INSERT INTO public.notifications (empresa_id, nivel, titulo, mensagem, meta)
    VALUES (
      v_empresa_id,
      'info',
      'Status do ticket atualizado',
      'Seu ticket de suporte foi atualizado para: ' || p_status,
      jsonb_build_object('ticket_id', p_ticket_id, 'tipo', 'support_status', 'status', p_status)
    );
  END IF;

  RETURN FOUND;
END;
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
