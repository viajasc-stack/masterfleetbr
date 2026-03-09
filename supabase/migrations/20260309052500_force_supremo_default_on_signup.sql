-- Garante que todo cadastro novo inicie no plano Supremo (fallback: Top, depois 1º ativo)

CREATE OR REPLACE FUNCTION public.criar_empresa_e_profile(
  p_nome_empresa text,
  p_nome_usuario text,
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_email_empresa text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_plano_id uuid;
  v_email text;
  v_trial_days int := COALESCE((public.get_billing_policy()->>'trial_days')::int, 7);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  INSERT INTO public.empresas (
    nome,
    cnpj,
    telefone,
    email,
    endereco,
    cidade,
    estado
  )
  VALUES (
    p_nome_empresa,
    NULLIF(btrim(p_cnpj), ''),
    NULLIF(btrim(p_telefone), ''),
    NULLIF(btrim(p_email_empresa), ''),
    NULLIF(btrim(p_endereco), ''),
    NULLIF(btrim(p_cidade), ''),
    NULLIF(upper(btrim(p_estado)), '')
  )
  RETURNING id INTO v_empresa_id;

  -- Regra principal: Supremo
  SELECT id INTO v_plano_id
  FROM public.planos
  WHERE COALESCE(lower(codigo), '') = 'supremo' AND ativo = true
  ORDER BY ordem
  LIMIT 1;

  -- Fallback 1: Top
  IF v_plano_id IS NULL THEN
    SELECT id INTO v_plano_id
    FROM public.planos
    WHERE COALESCE(lower(codigo), '') = 'top' AND ativo = true
    ORDER BY ordem
    LIMIT 1;
  END IF;

  -- Fallback 2: primeiro plano ativo
  IF v_plano_id IS NULL THEN
    SELECT id INTO v_plano_id
    FROM public.planos
    WHERE ativo = true
    ORDER BY ordem
    LIMIT 1;
  END IF;

  INSERT INTO public.assinaturas (empresa_id, plano_id, status, trial_ate)
  VALUES (
    v_empresa_id,
    v_plano_id,
    'trial',
    now() + make_interval(days => GREATEST(v_trial_days, 0))
  );

  INSERT INTO public.profiles (user_id, empresa_id, nome, role)
  VALUES (v_user_id, v_empresa_id, p_nome_usuario, 'admin');

  IF to_regclass('public.usuarios') IS NOT NULL THEN
    SELECT u.email INTO v_email
    FROM auth.users u
    WHERE u.id = v_user_id;

    INSERT INTO public.usuarios (
      empresa_id,
      auth_user_id,
      nome,
      email,
      status
    )
    VALUES (
      v_empresa_id,
      v_user_id,
      p_nome_usuario,
      v_email,
      'ativo'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
  END IF;

  RETURN v_empresa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_assinatura_for_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_id uuid;
  v_trial_days int := COALESCE((public.get_billing_policy()->>'trial_days')::int, 7);
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.empresa_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Regra principal: Supremo
  SELECT id INTO v_plano_id
  FROM public.planos
  WHERE COALESCE(lower(codigo), '') = 'supremo' AND ativo = true
  ORDER BY ordem
  LIMIT 1;

  -- Fallback 1: Top
  IF v_plano_id IS NULL THEN
    SELECT id INTO v_plano_id
    FROM public.planos
    WHERE COALESCE(lower(codigo), '') = 'top' AND ativo = true
    ORDER BY ordem
    LIMIT 1;
  END IF;

  -- Fallback 2: primeiro plano ativo
  IF v_plano_id IS NULL THEN
    SELECT id INTO v_plano_id
    FROM public.planos
    WHERE ativo = true
    ORDER BY ordem
    LIMIT 1;
  END IF;

  INSERT INTO public.assinaturas (empresa_id, plano_id, status, trial_ate)
  VALUES (
    NEW.id,
    v_plano_id,
    'trial',
    now() + make_interval(days => GREATEST(v_trial_days, 0))
  );

  RETURN NEW;
END;
$$;
