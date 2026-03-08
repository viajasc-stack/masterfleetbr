-- Sistema de suporte (empresa + master)

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  assunto text NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  prioridade text NOT NULL DEFAULT 'media'
    CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado')),
  origem text NOT NULL DEFAULT 'painel_empresa'
    CHECK (origem IN ('painel_empresa', 'master', 'sistema')),
  first_response_at timestamptz,
  resolved_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  autor_user_id uuid,
  autor_tipo text NOT NULL CHECK (autor_tipo IN ('empresa', 'master', 'sistema')),
  mensagem text NOT NULL,
  interna boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_empresa ON public.support_tickets(empresa_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_last_message_at ON public.support_tickets(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created ON public.support_messages(ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.set_updated_at_support_tickets()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_support_tickets();

CREATE OR REPLACE FUNCTION public.set_support_ticket_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.empresa_id::text, '') = '' THEN
    NEW.empresa_id := public.minha_empresa_id();
  END IF;

  IF COALESCE(NEW.created_by::text, '') = '' THEN
    NEW.created_by := auth.uid();
  END IF;

  NEW.last_message_at := COALESCE(NEW.last_message_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_defaults ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_defaults
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_support_ticket_defaults();

CREATE OR REPLACE FUNCTION public.sync_support_ticket_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT t.empresa_id, t.status
    INTO NEW.empresa_id, v_status
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
    END
  WHERE t.id = NEW.ticket_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_messages_sync_ticket ON public.support_messages;
CREATE TRIGGER trg_support_messages_sync_ticket
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_support_ticket_on_message();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_tickets_empresa_select ON public.support_tickets;
CREATE POLICY support_tickets_empresa_select
  ON public.support_tickets
  FOR SELECT
  USING (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS support_tickets_empresa_insert ON public.support_tickets;
CREATE POLICY support_tickets_empresa_insert
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS support_tickets_empresa_update ON public.support_tickets;
CREATE POLICY support_tickets_empresa_update
  ON public.support_tickets
  FOR UPDATE
  USING (empresa_id = public.minha_empresa_id())
  WITH CHECK (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS support_tickets_master_select ON public.support_tickets;
CREATE POLICY support_tickets_master_select
  ON public.support_tickets
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS support_tickets_master_update ON public.support_tickets;
CREATE POLICY support_tickets_master_update
  ON public.support_tickets
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS support_messages_empresa_select ON public.support_messages;
CREATE POLICY support_messages_empresa_select
  ON public.support_messages
  FOR SELECT
  USING (
    empresa_id = public.minha_empresa_id()
    AND (interna = false OR autor_tipo = 'empresa')
  );

DROP POLICY IF EXISTS support_messages_empresa_insert ON public.support_messages;
CREATE POLICY support_messages_empresa_insert
  ON public.support_messages
  FOR INSERT
  WITH CHECK (
    empresa_id = public.minha_empresa_id()
    AND autor_tipo = 'empresa'
    AND interna = false
  );

DROP POLICY IF EXISTS support_messages_master_select ON public.support_messages;
CREATE POLICY support_messages_master_select
  ON public.support_messages
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS support_messages_master_insert ON public.support_messages;
CREATE POLICY support_messages_master_insert
  ON public.support_messages
  FOR INSERT
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.support_create_ticket(
  p_assunto text,
  p_categoria text DEFAULT 'geral',
  p_prioridade text DEFAULT 'media',
  p_mensagem text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
  v_empresa_id uuid := public.minha_empresa_id();
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF COALESCE(btrim(p_assunto), '') = '' THEN
    RAISE EXCEPTION 'assunto_required';
  END IF;

  INSERT INTO public.support_tickets (
    empresa_id,
    created_by,
    assunto,
    categoria,
    prioridade,
    status,
    origem
  ) VALUES (
    v_empresa_id,
    v_user_id,
    btrim(p_assunto),
    COALESCE(NULLIF(btrim(p_categoria), ''), 'geral'),
    COALESCE(NULLIF(btrim(p_prioridade), ''), 'media'),
    'aberto',
    'painel_empresa'
  ) RETURNING id INTO v_ticket_id;

  IF COALESCE(btrim(COALESCE(p_mensagem, '')), '') <> '' THEN
    INSERT INTO public.support_messages (
      ticket_id,
      empresa_id,
      autor_user_id,
      autor_tipo,
      mensagem,
      interna
    ) VALUES (
      v_ticket_id,
      v_empresa_id,
      v_user_id,
      'empresa',
      btrim(p_mensagem),
      false
    );
  END IF;

  RETURN v_ticket_id;
END;
$$;

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF COALESCE(btrim(p_mensagem), '') = '' THEN
    RAISE EXCEPTION 'mensagem_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.support_tickets t
    WHERE t.id = p_ticket_id
      AND t.empresa_id = v_empresa_id
  ) THEN
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
    'empresa',
    btrim(p_mensagem),
    false
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_support_list_tickets(
  p_status text DEFAULT NULL,
  p_prioridade text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  empresa_nome text,
  assunto text,
  categoria text,
  prioridade text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  last_message_at timestamptz,
  total_mensagens bigint,
  ultima_mensagem text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.empresa_id,
    e.nome AS empresa_nome,
    t.assunto,
    t.categoria,
    t.prioridade,
    t.status,
    t.created_at,
    t.updated_at,
    t.last_message_at,
    COALESCE(m.total_mensagens, 0) AS total_mensagens,
    m.ultima_mensagem
  FROM public.support_tickets t
  JOIN public.empresas e ON e.id = t.empresa_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total_mensagens,
      (ARRAY_AGG(sm.mensagem ORDER BY sm.created_at DESC))[1] AS ultima_mensagem
    FROM public.support_messages sm
    WHERE sm.ticket_id = t.id
      AND sm.interna = false
  ) m ON true
  WHERE (p_status IS NULL OR p_status = '' OR t.status = p_status)
    AND (p_prioridade IS NULL OR p_prioridade = '' OR t.prioridade = p_prioridade)
    AND (
      p_busca IS NULL OR p_busca = ''
      OR e.nome ILIKE ('%' || p_busca || '%')
      OR t.assunto ILIKE ('%' || p_busca || '%')
      OR t.id::text ILIKE ('%' || p_busca || '%')
    )
  ORDER BY
    CASE t.status
      WHEN 'aberto' THEN 1
      WHEN 'em_andamento' THEN 2
      WHEN 'aguardando_cliente' THEN 3
      WHEN 'resolvido' THEN 4
      ELSE 5
    END,
    t.last_message_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.master_support_get_ticket(
  p_ticket_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT jsonb_build_object(
    'ticket',
      to_jsonb(t) || jsonb_build_object(
        'empresa_nome', e.nome,
        'empresa_email', e.email
      ),
    'messages',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sm.id,
            'ticket_id', sm.ticket_id,
            'empresa_id', sm.empresa_id,
            'autor_user_id', sm.autor_user_id,
            'autor_tipo', sm.autor_tipo,
            'autor_nome', COALESCE(p.nome, 'Usuário'),
            'mensagem', sm.mensagem,
            'interna', sm.interna,
            'created_at', sm.created_at
          )
          ORDER BY sm.created_at ASC
        )
        FROM public.support_messages sm
        LEFT JOIN public.profiles p ON p.user_id = sm.autor_user_id
        WHERE sm.ticket_id = t.id
      ), '[]'::jsonb)
  )
  INTO v_payload
  FROM public.support_tickets t
  JOIN public.empresas e ON e.id = t.empresa_id
  WHERE t.id = p_ticket_id;

  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  RETURN v_payload;
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

  IF NOT EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = p_ticket_id) THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  INSERT INTO public.support_messages (
    ticket_id,
    empresa_id,
    autor_user_id,
    autor_tipo,
    mensagem,
    interna
  )
  SELECT
    t.id,
    t.empresa_id,
    v_user_id,
    'master',
    btrim(p_mensagem),
    COALESCE(p_interna, false)
  FROM public.support_tickets t
  WHERE t.id = p_ticket_id;

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
    updated_at = now()
  WHERE t.id = p_ticket_id;

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
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_status NOT IN ('aberto', 'em_andamento', 'aguardando_cliente', 'resolvido', 'fechado') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF p_prioridade IS NOT NULL AND p_prioridade <> ''
    AND p_prioridade NOT IN ('baixa', 'media', 'alta', 'critica') THEN
    RAISE EXCEPTION 'invalid_prioridade';
  END IF;

  UPDATE public.support_tickets t
  SET
    status = p_status,
    prioridade = COALESCE(NULLIF(btrim(p_prioridade), ''), t.prioridade),
    resolved_at = CASE
      WHEN p_status IN ('resolvido', 'fechado') THEN COALESCE(t.resolved_at, now())
      ELSE NULL
    END,
    updated_at = now()
  WHERE t.id = p_ticket_id;

  RETURN FOUND;
END;
$$;
