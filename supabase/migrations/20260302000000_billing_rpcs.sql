-- =============================================================================
-- Billing RPCs: get_billing_current() e admin_mark_paid()
-- =============================================================================

-- Retorna o estado de cobrança atual para a empresa do usuário logado
CREATE OR REPLACE FUNCTION public.get_billing_current()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  e uuid := public.minha_empresa_id();
  assin record;
  fat record;
BEGIN
  IF e IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, status, trial_ate, proxima_cobranca, plano_id
    INTO assin
    FROM public.assinaturas
   WHERE empresa_id = e
   LIMIT 1;

  SELECT id, valor_centavos, status AS fatura_status, vencimento, pix_qr_code, pix_copia_cola
    INTO fat
    FROM public.faturas
   WHERE empresa_id = e AND status = 'aberta'
   ORDER BY created_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'empresa_id', e,
    'status', assin.status,
    'trial_ate', assin.trial_ate,
    'proxima_cobranca', assin.proxima_cobranca,
    'plano_id', assin.plano_id,
    'fatura_id', COALESCE(fat.id, NULL),
    'valor_centavos', COALESCE(fat.valor_centavos, NULL),
    'fatura_status', COALESCE(fat.fatura_status, NULL),
    'vencimento', COALESCE(fat.vencimento, NULL),
    'pix_qr_code', COALESCE(fat.pix_qr_code, NULL),
    'pix_copia_cola', COALESCE(fat.pix_copia_cola, NULL)
  );
END;
$$;


-- Função administrativa para marcar fatura como paga (apenas super admin)
CREATE OR REPLACE FUNCTION public.admin_mark_paid(p_fatura_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  f record;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id, empresa_id, assinatura_id, status
    INTO f
    FROM public.faturas
   WHERE id = p_fatura_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.faturas
     SET status = 'paga', updated_at = now()
   WHERE id = p_fatura_id;

  IF f.assinatura_id IS NOT NULL THEN
    UPDATE public.assinaturas
       SET status = 'ativa', proxima_cobranca = (current_date + interval '1 month')::date, updated_at = now()
     WHERE id = f.assinatura_id;
  END IF;

  RETURN TRUE;
END;
$$;
