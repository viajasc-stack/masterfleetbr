-- Reconciliacao imediata de billing ao salvar empresa no painel master

CREATE OR REPLACE FUNCTION public.master_reconcile_empresa_billing(
  p_empresa_id uuid,
  p_reason text DEFAULT 'manual_update'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura record;
  v_policy jsonb;
  v_grace_days int := 5;
  v_auto_block boolean := true;
  v_today date := current_date;
  v_due_date date;
  v_days_overdue int := 0;
  v_old_status text;
  v_new_status text;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT a.id, a.status, a.trial_ate, a.proxima_cobranca
    INTO v_assinatura
  FROM public.assinaturas a
  WHERE a.empresa_id = p_empresa_id
  ORDER BY a.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_assinatura.id IS NULL THEN
    RAISE EXCEPTION 'assinatura_not_found';
  END IF;

  v_old_status := COALESCE(v_assinatura.status, 'trial');
  v_new_status := v_old_status;

  IF v_old_status = 'cancelada' THEN
    RETURN jsonb_build_object(
      'empresa_id', p_empresa_id,
      'assinatura_id', v_assinatura.id,
      'status_anterior', v_old_status,
      'status_novo', v_new_status,
      'motivo', 'cancelada_inalterada'
    );
  END IF;

  v_policy := public.get_billing_policy();
  v_grace_days := GREATEST(COALESCE((v_policy->>'grace_days')::int, 5), 0);
  v_auto_block := COALESCE((v_policy->>'auto_block')::boolean, true);

  IF v_old_status = 'trial' THEN
    v_due_date := (v_assinatura.trial_ate AT TIME ZONE 'UTC')::date;
  ELSE
    v_due_date := (v_assinatura.proxima_cobranca AT TIME ZONE 'UTC')::date;
  END IF;

  IF v_due_date IS NULL THEN
    RETURN jsonb_build_object(
      'empresa_id', p_empresa_id,
      'assinatura_id', v_assinatura.id,
      'status_anterior', v_old_status,
      'status_novo', v_new_status,
      'motivo', 'sem_data_referencia'
    );
  END IF;

  v_days_overdue := (v_today - v_due_date);

  IF v_old_status = 'trial' THEN
    IF v_days_overdue > 0 THEN
      v_new_status := 'past_due';
      IF v_auto_block AND v_days_overdue > v_grace_days THEN
        v_new_status := 'bloqueada';
      END IF;
    ELSE
      v_new_status := 'trial';
    END IF;
  ELSE
    IF v_days_overdue > 0 THEN
      v_new_status := 'past_due';
      IF v_auto_block AND v_days_overdue > v_grace_days THEN
        v_new_status := 'bloqueada';
      END IF;
    ELSE
      IF v_old_status IN ('past_due', 'bloqueada') THEN
        v_new_status := 'ativa';
      END IF;
    END IF;
  END IF;

  IF v_new_status IS DISTINCT FROM v_old_status THEN
    UPDATE public.assinaturas a
    SET
      status = v_new_status,
      updated_at = now()
    WHERE a.id = v_assinatura.id;

    IF to_regclass('public.master_empresa_audit_log') IS NOT NULL THEN
      INSERT INTO public.master_empresa_audit_log (empresa_id, action, payload, actor_user_id)
      VALUES (
        p_empresa_id,
        'billing_reconcile',
        jsonb_build_object(
          'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'manual_update'),
          'status_anterior', v_old_status,
          'status_novo', v_new_status,
          'due_date', v_due_date,
          'dias_atraso', v_days_overdue,
          'grace_days', v_grace_days,
          'auto_block', v_auto_block
        ),
        v_actor
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', p_empresa_id,
    'assinatura_id', v_assinatura.id,
    'status_anterior', v_old_status,
    'status_novo', v_new_status,
    'due_date', v_due_date,
    'dias_atraso', v_days_overdue,
    'grace_days', v_grace_days,
    'auto_block', v_auto_block
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
  p_plano_id uuid DEFAULT NULL,
  p_modulos text[] DEFAULT NULL
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
      proxima_cobranca,
      billing_model
    ) VALUES (
      p_empresa_id,
      p_plano_id,
      COALESCE(p_status, 'trial'),
      p_trial_ate,
      p_proxima_cobranca,
      'modular'
    );
  ELSE
    UPDATE public.assinaturas
    SET
      status = COALESCE(p_status, status),
      trial_ate = p_trial_ate,
      proxima_cobranca = p_proxima_cobranca,
      plano_id = p_plano_id,
      billing_model = 'modular',
      updated_at = now()
    WHERE id = v_assinatura_id;
  END IF;

  PERFORM public.master_set_empresa_modulos(p_empresa_id, COALESCE(p_modulos, ARRAY[]::text[]));

  -- Recalcula status automaticamente ao salvar no painel master
  PERFORM public.master_reconcile_empresa_billing(p_empresa_id, 'master_save_empresa_editor');

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.master_reconcile_empresa_billing(uuid, text) TO authenticated;
