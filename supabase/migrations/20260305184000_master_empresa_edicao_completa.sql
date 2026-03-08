-- Edição completa da empresa (painel master)

CREATE OR REPLACE FUNCTION public.master_get_empresa_editor(
  p_empresa_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa jsonb;
  v_assinatura jsonb;
  v_planos jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT to_jsonb(e)
  INTO v_empresa
  FROM public.empresas e
  WHERE e.id = p_empresa_id;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT to_jsonb(a)
  INTO v_assinatura
  FROM public.assinaturas a
  WHERE a.empresa_id = p_empresa_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.ordem, p.nome), '[]'::jsonb)
  INTO v_planos
  FROM public.planos p
  WHERE p.ativo = true;

  RETURN jsonb_build_object(
    'empresa', v_empresa,
    'assinatura', COALESCE(v_assinatura, '{}'::jsonb),
    'planos', v_planos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.master_save_empresa_editor(
  p_empresa_id uuid,
  p_nome text,
  p_email text DEFAULT NULL,
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_trial_ate timestamptz DEFAULT NULL,
  p_proxima_cobranca timestamptz DEFAULT NULL,
  p_plano_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = p_empresa_id) THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  UPDATE public.empresas
  SET
    nome = p_nome,
    email = NULLIF(btrim(p_email), '')
  WHERE id = p_empresa_id;

  -- Campos opcionais (dependem de coluna existir no schema do ambiente)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'cnpj'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET cnpj = $1 WHERE id = $2'
      USING NULLIF(btrim(p_cnpj), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'telefone'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET telefone = $1 WHERE id = $2'
      USING NULLIF(btrim(p_telefone), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'endereco'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET endereco = $1 WHERE id = $2'
      USING NULLIF(btrim(p_endereco), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'cidade'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET cidade = $1 WHERE id = $2'
      USING NULLIF(btrim(p_cidade), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'estado'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET estado = $1 WHERE id = $2'
      USING NULLIF(btrim(p_estado), ''), p_empresa_id;
  END IF;

  SELECT a.id
  INTO v_assinatura_id
  FROM public.assinaturas a
  WHERE a.empresa_id = p_empresa_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_assinatura_id IS NULL THEN
    INSERT INTO public.assinaturas (
      empresa_id,
      plano_id,
      status,
      trial_ate,
      proxima_cobranca
    ) VALUES (
      p_empresa_id,
      p_plano_id,
      COALESCE(p_status, 'trial'),
      p_trial_ate,
      p_proxima_cobranca
    );
  ELSE
    UPDATE public.assinaturas
    SET
      status = COALESCE(p_status, status),
      trial_ate = p_trial_ate,
      proxima_cobranca = p_proxima_cobranca,
      plano_id = p_plano_id
    WHERE id = v_assinatura_id;
  END IF;

  RETURN true;
END;
$$;
