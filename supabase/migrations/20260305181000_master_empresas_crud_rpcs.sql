-- RPCs do painel master para listar/criar/editar/excluir empresas

CREATE OR REPLACE FUNCTION public.master_list_empresas()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  status text,
  proxima_cobranca timestamptz,
  trial_ate timestamptz,
  plano_nome text
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
    e.id,
    e.nome,
    e.email,
    e.created_at,
    a.status,
    a.proxima_cobranca,
    a.trial_ate,
    p.nome AS plano_nome
  FROM public.empresas e
  LEFT JOIN LATERAL (
    SELECT ax.*
    FROM public.assinaturas ax
    WHERE ax.empresa_id = e.id
    ORDER BY ax.created_at DESC
    LIMIT 1
  ) a ON true
  LEFT JOIN public.planos p ON p.id = a.plano_id
  ORDER BY e.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_create_empresa(
  p_nome text,
  p_email text DEFAULT NULL
)
RETURNS uuid
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

  INSERT INTO public.empresas (nome, email)
  VALUES (p_nome, NULLIF(btrim(p_email), ''))
  RETURNING id INTO v_empresa_id;

  RETURN v_empresa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_update_empresa(
  p_empresa_id uuid,
  p_nome text,
  p_email text DEFAULT NULL
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

  UPDATE public.empresas
  SET
    nome = p_nome,
    email = NULLIF(btrim(p_email), '')
  WHERE id = p_empresa_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_delete_empresas(
  p_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.empresas e
  WHERE e.id = ANY (p_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
