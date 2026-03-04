-- Garante que o usuário inicial (admin/dono) também exista em public.usuarios
-- e evita que a listagem/edição fique vazia para esse perfil.

-- 1) Recria RPC de cadastro para também inserir na tabela usuarios (quando existir)
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

  -- Pega primeiro plano ativo (ou null)
  SELECT id INTO v_plano_id FROM public.planos WHERE ativo = true ORDER BY ordem LIMIT 1;

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

-- 2) Backfill para empresas já cadastradas: cria usuarios faltantes a partir de profiles
INSERT INTO public.usuarios (
  empresa_id,
  auth_user_id,
  nome,
  email,
  status
)
SELECT
  p.empresa_id,
  p.user_id,
  COALESCE(NULLIF(p.nome, ''), 'Usuário'),
  u.email,
  'ativo'
FROM public.profiles p
LEFT JOIN public.usuarios up ON up.auth_user_id = p.user_id
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE p.empresa_id IS NOT NULL
  AND p.role IN ('dono', 'admin', 'usuario')
  AND up.auth_user_id IS NULL;
