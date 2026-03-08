-- Define plano TOP como padrão para novas empresas

CREATE OR REPLACE FUNCTION public.criar_empresa_e_profile(
  p_nome_empresa text,
  p_nome_usuario text
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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Cria empresa
  INSERT INTO public.empresas (nome) VALUES (p_nome_empresa)
  RETURNING id INTO v_empresa_id;

  -- Prioriza plano TOP ativo como padrão
  SELECT id INTO v_plano_id
  FROM public.planos
  WHERE codigo = 'top' AND ativo = true
  ORDER BY ordem
  LIMIT 1;

  -- Fallback: primeiro plano ativo
  IF v_plano_id IS NULL THEN
    SELECT id INTO v_plano_id
    FROM public.planos
    WHERE ativo = true
    ORDER BY ordem
    LIMIT 1;
  END IF;

  -- Cria assinatura trial 7 dias
  INSERT INTO public.assinaturas (empresa_id, plano_id, status, trial_ate)
  VALUES (
    v_empresa_id,
    v_plano_id,
    'trial',
    now() + interval '7 days'
  );

  -- Cria profile (admin da empresa)
  INSERT INTO public.profiles (user_id, empresa_id, nome, role)
  VALUES (v_user_id, v_empresa_id, p_nome_usuario, 'admin');

  -- Se a tabela de usuários do painel existir, também cria o registro base nela
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
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.empresa_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Prioriza plano TOP ativo como padrão
  SELECT id INTO v_plano_id
  FROM public.planos
  WHERE codigo = 'top' AND ativo = true
  ORDER BY ordem
  LIMIT 1;

  -- Fallback: primeiro plano ativo
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
    now() + interval '7 days'
  );

  RETURN NEW;
END;
$$;

-- Opcional: corrige assinaturas já criadas sem plano, usando TOP ativo
UPDATE public.assinaturas a
SET plano_id = p.id
FROM public.planos p
WHERE a.plano_id IS NULL
  AND p.codigo = 'top'
  AND p.ativo = true;
