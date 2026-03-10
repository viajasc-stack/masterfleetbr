-- Fix operacional: garantir que edição manual no painel master
-- reflita imediatamente na(s) linha(s) de assinaturas da empresa.

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
  v_has_assinatura boolean := false;
  v_target_status text;
  v_target_trial_ate timestamptz;
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

  v_target_status := COALESCE(NULLIF(btrim(p_status), ''), 'trial');
  v_target_trial_ate := CASE WHEN v_target_status = 'trial' THEN p_trial_ate ELSE NULL END;

  SELECT EXISTS (
    SELECT 1 FROM public.assinaturas a WHERE a.empresa_id = p_empresa_id
  ) INTO v_has_assinatura;

  IF NOT v_has_assinatura THEN
    INSERT INTO public.assinaturas (
      empresa_id,
      plano_id,
      status,
      trial_ate,
      proxima_cobranca
    ) VALUES (
      p_empresa_id,
      p_plano_id,
      v_target_status,
      v_target_trial_ate,
      p_proxima_cobranca
    );
  ELSE
    UPDATE public.assinaturas
    SET
      status = COALESCE(NULLIF(btrim(p_status), ''), status),
      trial_ate = CASE
        WHEN COALESCE(NULLIF(btrim(p_status), ''), status) = 'trial' THEN p_trial_ate
        ELSE NULL
      END,
      proxima_cobranca = p_proxima_cobranca,
      plano_id = COALESCE(p_plano_id, plano_id),
      updated_at = now()
    WHERE empresa_id = p_empresa_id;
  END IF;

  RETURN true;
END;
$$;

NOTIFY pgrst, 'reload schema';
