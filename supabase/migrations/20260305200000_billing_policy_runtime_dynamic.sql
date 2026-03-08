-- Torna a política de cobrança realmente automática em runtime

CREATE OR REPLACE FUNCTION public.get_billing_policy()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF to_regclass('public.master_settings') IS NULL THEN
    RETURN jsonb_build_object(
      'trial_days', 7,
      'grace_days', 5,
      'auto_block', true
    );
  END IF;

  SELECT ms.value INTO v
  FROM public.master_settings ms
  WHERE ms.key = 'billing_policy'
  LIMIT 1;

  RETURN jsonb_build_object(
    'trial_days', COALESCE((v->>'trial_days')::int, 7),
    'grace_days', COALESCE((v->>'grace_days')::int, 5),
    'auto_block', COALESCE((v->>'auto_block')::boolean, true)
  );
END;
$$;

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
  v_trial_days int := COALESCE((public.get_billing_policy()->>'trial_days')::int, 7);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  INSERT INTO public.empresas (nome) VALUES (p_nome_empresa)
  RETURNING id INTO v_empresa_id;

  SELECT id INTO v_plano_id
  FROM public.planos
  WHERE codigo = 'top' AND ativo = true
  ORDER BY ordem
  LIMIT 1;

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

  SELECT id INTO v_plano_id
  FROM public.planos
  WHERE codigo = 'top' AND ativo = true
  ORDER BY ordem
  LIMIT 1;

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

CREATE OR REPLACE FUNCTION public.generate_my_manual_invoice()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_assinatura record;
  v_fatura_existente uuid;
  v_fatura_id uuid;
  v_valor integer;
  v_vencimento date;
  v_grace_days int := COALESCE((public.get_billing_policy()->>'grace_days')::int, 5);
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT a.id, a.plano_id, a.proxima_cobranca, p.valor_centavos
    INTO v_assinatura
    FROM public.assinaturas a
    LEFT JOIN public.planos p ON p.id = a.plano_id
   WHERE a.empresa_id = v_empresa_id
   LIMIT 1;

  IF v_assinatura.id IS NULL THEN
    RAISE EXCEPTION 'assinatura_not_found';
  END IF;

  v_valor := COALESCE(v_assinatura.valor_centavos, 9900);
  v_vencimento := COALESCE(v_assinatura.proxima_cobranca, (current_date + GREATEST(v_grace_days, 0)));

  SELECT f.id INTO v_fatura_existente
    FROM public.faturas f
   WHERE f.empresa_id = v_empresa_id
     AND f.assinatura_id = v_assinatura.id
     AND f.status = 'aberta'
     AND f.vencimento = v_vencimento
   LIMIT 1;

  IF v_fatura_existente IS NOT NULL THEN
    RETURN v_fatura_existente;
  END IF;

  INSERT INTO public.faturas (
    empresa_id,
    assinatura_id,
    valor_centavos,
    status,
    vencimento
  ) VALUES (
    v_empresa_id,
    v_assinatura.id,
    v_valor,
    'aberta',
    v_vencimento
  )
  RETURNING id INTO v_fatura_id;

  RETURN v_fatura_id;
END;
$$;
