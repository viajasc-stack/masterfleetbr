-- RPCs de planos para painel master (contorna RLS com segurança de super admin)

CREATE OR REPLACE FUNCTION public.master_list_planos()
RETURNS TABLE (
  id uuid,
  codigo text,
  nome text,
  descricao text,
  valor_centavos bigint,
  ativo boolean,
  ordem int,
  modulos jsonb
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
  SELECT p.id, p.codigo, p.nome, p.descricao, p.valor_centavos, p.ativo, p.ordem, p.modulos
  FROM public.planos p
  ORDER BY p.ordem, p.nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_save_plano(
  p_id uuid DEFAULT NULL,
  p_codigo text DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_valor_centavos bigint DEFAULT 0,
  p_ordem int DEFAULT 0,
  p_ativo boolean DEFAULT true,
  p_modulos jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'nome_required';
  END IF;

  IF jsonb_typeof(COALESCE(p_modulos, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'modulos_must_be_array';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.planos (codigo, nome, descricao, valor_centavos, ordem, ativo, modulos)
    VALUES (
      NULLIF(btrim(p_codigo), ''),
      btrim(p_nome),
      NULLIF(btrim(p_descricao), ''),
      COALESCE(p_valor_centavos, 0),
      COALESCE(p_ordem, 0),
      COALESCE(p_ativo, true),
      COALESCE(p_modulos, '[]'::jsonb)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.planos
    SET
      codigo = NULLIF(btrim(p_codigo), ''),
      nome = btrim(p_nome),
      descricao = NULLIF(btrim(p_descricao), ''),
      valor_centavos = COALESCE(p_valor_centavos, 0),
      ordem = COALESCE(p_ordem, 0),
      ativo = COALESCE(p_ativo, ativo),
      modulos = COALESCE(p_modulos, '[]'::jsonb)
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'plano_not_found';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_toggle_plano_ativo(
  p_plano_id uuid,
  p_ativo boolean
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

  UPDATE public.planos
  SET ativo = p_ativo
  WHERE id = p_plano_id;

  RETURN FOUND;
END;
$$;
