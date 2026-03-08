-- Suporte: permite super admin assumir contexto de uma empresa no painel

CREATE OR REPLACE FUNCTION public.master_assume_empresa(
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_nome text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = p_empresa_id) THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT p.nome INTO v_nome
  FROM public.profiles p
  WHERE p.user_id = v_user_id;

  INSERT INTO public.profiles (user_id, empresa_id, nome, role)
  VALUES (v_user_id, p_empresa_id, COALESCE(v_nome, 'Suporte Master'), 'admin')
  ON CONFLICT (user_id)
  DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    role = 'admin',
    nome = COALESCE(public.profiles.nome, EXCLUDED.nome);

  RETURN true;
END;
$$;
