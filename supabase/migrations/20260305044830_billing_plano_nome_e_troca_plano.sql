-- Exibe nome do plano na RPC de billing e permite troca de plano pela própria empresa

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

  SELECT a.id, a.status, a.trial_ate, a.proxima_cobranca, a.plano_id, p.nome AS plano_nome
    INTO assin
    FROM public.assinaturas a
    LEFT JOIN public.planos p ON p.id = a.plano_id
   WHERE a.empresa_id = e
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
    'plano_nome', assin.plano_nome,
    'fatura_id', COALESCE(fat.id, NULL),
    'valor_centavos', COALESCE(fat.valor_centavos, NULL),
    'fatura_status', COALESCE(fat.fatura_status, NULL),
    'vencimento', COALESCE(fat.vencimento, NULL),
    'pix_qr_code', COALESCE(fat.pix_qr_code, NULL),
    'pix_copia_cola', COALESCE(fat.pix_copia_cola, NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.change_my_plan(p_plano_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e uuid := public.minha_empresa_id();
BEGIN
  IF e IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.planos p
    WHERE p.id = p_plano_id
      AND p.ativo = true
  ) THEN
    RAISE EXCEPTION 'plano_invalido';
  END IF;

  UPDATE public.assinaturas
     SET plano_id = p_plano_id,
         updated_at = now()
   WHERE empresa_id = e;

  RETURN FOUND;
END;
$$;
