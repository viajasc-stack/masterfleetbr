-- Ativação explícita do Convide e Ganhe pela empresa

CREATE OR REPLACE FUNCTION public.activate_my_referral_program()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_code text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assinaturas a
    WHERE a.empresa_id = v_empresa_id
      AND a.status = 'ativa'
  ) THEN
    RAISE EXCEPTION 'assinatura_not_active';
  END IF;

  v_code := public.ensure_referral_code(v_empresa_id);

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'referral_code', v_code,
    'activated', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_my_referral_program() TO authenticated;

NOTIFY pgrst, 'reload schema';
