-- Evolução cupons: aplicação automática por código (signup/checkout) + reversão auditável

CREATE TABLE IF NOT EXISTS public.billing_coupon_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.billing_coupons(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  claim_code text NOT NULL,
  source text NOT NULL DEFAULT 'signup' CHECK (source IN ('signup', 'checkout', 'manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled', 'expired')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  claimed_by uuid,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  applied_redemption_id uuid REFERENCES public.billing_coupon_redemptions(id) ON DELETE SET NULL,
  applied_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE (coupon_id, empresa_id, source)
);

CREATE INDEX IF NOT EXISTS idx_billing_coupon_claims_empresa_status ON public.billing_coupon_claims (empresa_id, status, claimed_at DESC);

CREATE OR REPLACE FUNCTION public.billing_apply_coupon_core(
  p_coupon_id uuid,
  p_empresa_id uuid,
  p_fatura_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.billing_coupons%ROWTYPE;
  v_fatura record;
  v_existing_company_uses integer := 0;
  v_total_redemptions bigint := 0;
  v_discount_centavos bigint := 0;
  v_now timestamptz := now();
  v_final_centavos bigint := 0;
  v_redemption_id uuid;
BEGIN
  SELECT *
    INTO v_coupon
    FROM public.billing_coupons
   WHERE id = p_coupon_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;

  IF COALESCE(v_coupon.active, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'coupon_inactive';
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND v_now < v_coupon.valid_from THEN
    RAISE EXCEPTION 'coupon_not_started';
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_now > v_coupon.valid_until THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;

  SELECT COUNT(*)::int
    INTO v_existing_company_uses
    FROM public.billing_coupon_redemptions r
   WHERE r.coupon_id = v_coupon.id
     AND r.empresa_id = p_empresa_id
     AND r.status = 'applied';

  IF v_existing_company_uses >= COALESCE(v_coupon.max_redemptions_per_empresa, 1) THEN
    RAISE EXCEPTION 'coupon_max_redemptions_per_empresa_reached';
  END IF;

  SELECT COUNT(*)::bigint
    INTO v_total_redemptions
    FROM public.billing_coupon_redemptions r
   WHERE r.coupon_id = v_coupon.id
     AND r.status = 'applied';

  IF v_coupon.max_redemptions IS NOT NULL AND v_total_redemptions >= v_coupon.max_redemptions THEN
    RAISE EXCEPTION 'coupon_max_redemptions_reached';
  END IF;

  IF p_fatura_id IS NOT NULL THEN
    SELECT
      f.id,
      f.empresa_id,
      f.status,
      COALESCE(f.valor_bruto_centavos, f.valor_centavos, 0)::bigint AS valor_bruto_centavos,
      COALESCE(f.desconto_centavos, 0)::bigint AS desconto_centavos,
      COALESCE(f.desconto_detalhe, '{}'::jsonb) AS desconto_detalhe
    INTO v_fatura
    FROM public.faturas f
    WHERE f.id = p_fatura_id
      AND f.empresa_id = p_empresa_id
    LIMIT 1;
  ELSE
    SELECT
      f.id,
      f.empresa_id,
      f.status,
      COALESCE(f.valor_bruto_centavos, f.valor_centavos, 0)::bigint AS valor_bruto_centavos,
      COALESCE(f.desconto_centavos, 0)::bigint AS desconto_centavos,
      COALESCE(f.desconto_detalhe, '{}'::jsonb) AS desconto_detalhe
    INTO v_fatura
    FROM public.faturas f
    WHERE f.empresa_id = p_empresa_id
      AND f.status = 'aberta'
    ORDER BY f.vencimento NULLS LAST, f.created_at DESC
    LIMIT 1;
  END IF;

  IF v_fatura.id IS NULL THEN
    RAISE EXCEPTION 'open_invoice_not_found';
  END IF;

  IF v_fatura.status <> 'aberta' THEN
    RAISE EXCEPTION 'invoice_must_be_open';
  END IF;

  IF v_coupon.first_invoice_only THEN
    IF EXISTS (
      SELECT 1
      FROM public.faturas fx
      WHERE fx.empresa_id = p_empresa_id
        AND fx.status = 'paga'
    ) THEN
      RAISE EXCEPTION 'coupon_first_invoice_only';
    END IF;
  END IF;

  IF v_fatura.valor_bruto_centavos < COALESCE(v_coupon.min_invoice_amount_centavos, 0) THEN
    RAISE EXCEPTION 'coupon_min_invoice_amount_not_met';
  END IF;

  IF COALESCE(v_coupon.stackable, false) IS DISTINCT FROM true AND COALESCE(v_fatura.desconto_centavos, 0) > 0 THEN
    RAISE EXCEPTION 'coupon_not_stackable_invoice_has_discount';
  END IF;

  IF v_coupon.discount_type = 'percent' THEN
    v_discount_centavos := floor(v_fatura.valor_bruto_centavos * (v_coupon.discount_value / 100.0));
  ELSE
    v_discount_centavos := round(v_coupon.discount_value * 100)::bigint;
  END IF;

  v_discount_centavos := LEAST(GREATEST(v_discount_centavos, 0), v_fatura.valor_bruto_centavos);
  IF v_discount_centavos <= 0 THEN
    RAISE EXCEPTION 'coupon_generated_zero_discount';
  END IF;

  v_final_centavos := GREATEST(v_fatura.valor_bruto_centavos - (COALESCE(v_fatura.desconto_centavos, 0) + v_discount_centavos), 0);

  UPDATE public.faturas f
     SET valor_bruto_centavos = v_fatura.valor_bruto_centavos,
         desconto_centavos = COALESCE(v_fatura.desconto_centavos, 0) + v_discount_centavos,
         valor_centavos = v_final_centavos,
         desconto_detalhe = COALESCE(v_fatura.desconto_detalhe, '{}'::jsonb) || jsonb_build_object(
           'coupon', jsonb_build_object(
             'coupon_id', v_coupon.id,
             'code', v_coupon.code,
             'discount_type', v_coupon.discount_type,
             'discount_value', v_coupon.discount_value,
             'discount_centavos', v_discount_centavos,
             'applied_at', now(),
             'applied_by', p_actor,
             'source', p_source,
             'observacao', NULLIF(btrim(COALESCE(p_observacao, '')), '')
           )
         ),
         updated_at = now()
   WHERE f.id = v_fatura.id;

  INSERT INTO public.billing_coupon_redemptions (
    coupon_id,
    empresa_id,
    fatura_id,
    status,
    discount_centavos,
    context,
    created_by,
    created_at
  ) VALUES (
    v_coupon.id,
    p_empresa_id,
    v_fatura.id,
    'applied',
    v_discount_centavos,
    jsonb_build_object(
      'coupon_code', v_coupon.code,
      'invoice_bruto_centavos', v_fatura.valor_bruto_centavos,
      'invoice_final_centavos', v_final_centavos,
      'stackable', v_coupon.stackable,
      'first_invoice_only', v_coupon.first_invoice_only,
      'source', p_source,
      'observacao', NULLIF(btrim(COALESCE(p_observacao, '')), '')
    ),
    p_actor,
    now()
  ) RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption_id,
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code,
    'fatura_id', v_fatura.id,
    'discount_centavos', v_discount_centavos,
    'valor_final_centavos', v_final_centavos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.master_apply_billing_coupon_to_empresa(
  p_coupon_id uuid,
  p_empresa_id uuid,
  p_fatura_id uuid DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN public.billing_apply_coupon_core(
    p_coupon_id,
    p_empresa_id,
    p_fatura_id,
    p_observacao,
    auth.uid(),
    'manual'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_my_billing_coupon_code(
  p_code text,
  p_fatura_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_coupon_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT c.id
    INTO v_coupon_id
    FROM public.billing_coupons c
   WHERE upper(c.code) = upper(btrim(COALESCE(p_code, '')))
     AND c.active = true
   LIMIT 1;

  IF v_coupon_id IS NULL THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;

  RETURN public.billing_apply_coupon_core(
    v_coupon_id,
    v_empresa_id,
    p_fatura_id,
    'Aplicação self-service por código',
    auth.uid(),
    'checkout'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_billing_coupon_on_signup(
  p_coupon_code text,
  p_empresa_id uuid,
  p_admin_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.billing_coupons%ROWTYPE;
  v_claim_id uuid;
BEGIN
  IF p_empresa_id IS NULL OR btrim(COALESCE(p_coupon_code, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  SELECT *
    INTO v_coupon
    FROM public.billing_coupons c
   WHERE upper(c.code) = upper(btrim(p_coupon_code))
     AND c.active = true
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_not_found');
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND now() < v_coupon.valid_from THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_not_started');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_expired');
  END IF;

  INSERT INTO public.billing_coupon_claims (
    coupon_id,
    empresa_id,
    claim_code,
    source,
    status,
    metadata,
    claimed_by,
    claimed_at
  )
  VALUES (
    v_coupon.id,
    p_empresa_id,
    upper(v_coupon.code),
    'signup',
    'pending',
    jsonb_build_object('admin_email', NULLIF(lower(btrim(COALESCE(p_admin_email, ''))), '')),
    NULL,
    now()
  )
  ON CONFLICT (coupon_id, empresa_id, source)
  DO UPDATE SET
    metadata = EXCLUDED.metadata,
    status = CASE
      WHEN public.billing_coupon_claims.status IN ('cancelled', 'expired') THEN 'pending'
      ELSE public.billing_coupon_claims.status
    END,
    claimed_at = now()
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object('ok', true, 'claim_id', v_claim_id, 'coupon_id', v_coupon.id, 'coupon_code', v_coupon.code);
END;
$$;

CREATE OR REPLACE FUNCTION public.on_invoice_apply_coupon_claims()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim record;
  v_result jsonb;
BEGIN
  IF NEW.status <> 'aberta' THEN
    RETURN NEW;
  END IF;

  SELECT c.*
    INTO v_claim
    FROM public.billing_coupon_claims c
   WHERE c.empresa_id = NEW.empresa_id
     AND c.status = 'pending'
   ORDER BY c.claimed_at ASC
   LIMIT 1
   FOR UPDATE;

  IF v_claim.id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_result := public.billing_apply_coupon_core(
      v_claim.coupon_id,
      NEW.empresa_id,
      NEW.id,
      'Aplicação automática de cupom no cadastro',
      NULL,
      'signup'
    );

    UPDATE public.billing_coupon_claims
       SET status = 'applied',
           applied_redemption_id = NULLIF(v_result->>'redemption_id', '')::uuid,
           applied_at = now()
     WHERE id = v_claim.id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.billing_coupon_claims
       SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_error', SQLERRM, 'last_error_at', now())
     WHERE id = v_claim.id;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_apply_coupon_claims ON public.faturas;
CREATE TRIGGER trg_invoice_apply_coupon_claims
  AFTER INSERT ON public.faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invoice_apply_coupon_claims();

CREATE OR REPLACE FUNCTION public.master_reverse_billing_coupon_redemption(
  p_redemption_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption public.billing_coupon_redemptions%ROWTYPE;
  v_invoice record;
  v_new_discount bigint;
  v_new_final bigint;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT *
    INTO v_redemption
    FROM public.billing_coupon_redemptions r
   WHERE r.id = p_redemption_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'redemption_not_found';
  END IF;

  IF v_redemption.status <> 'applied' THEN
    RAISE EXCEPTION 'redemption_not_active';
  END IF;

  SELECT
    f.id,
    COALESCE(f.valor_bruto_centavos, f.valor_centavos, 0)::bigint AS valor_bruto_centavos,
    COALESCE(f.desconto_centavos, 0)::bigint AS desconto_centavos,
    COALESCE(f.desconto_detalhe, '{}'::jsonb) AS desconto_detalhe
  INTO v_invoice
  FROM public.faturas f
  WHERE f.id = v_redemption.fatura_id
  FOR UPDATE;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'invoice_not_found';
  END IF;

  v_new_discount := GREATEST(COALESCE(v_invoice.desconto_centavos, 0) - COALESCE(v_redemption.discount_centavos, 0), 0);
  v_new_final := GREATEST(v_invoice.valor_bruto_centavos - v_new_discount, 0);

  UPDATE public.faturas
     SET desconto_centavos = v_new_discount,
         valor_centavos = v_new_final,
         desconto_detalhe = COALESCE(v_invoice.desconto_detalhe, '{}'::jsonb) || jsonb_build_object(
           'coupon_reversal', jsonb_build_object(
             'redemption_id', v_redemption.id,
             'reason', NULLIF(btrim(COALESCE(p_reason, '')), ''),
             'reversed_by', auth.uid(),
             'reversed_at', now(),
             'discount_reverted_centavos', v_redemption.discount_centavos
           )
         ),
         updated_at = now()
   WHERE id = v_invoice.id;

  UPDATE public.billing_coupon_redemptions
     SET status = 'cancelled',
         cancelled_at = now(),
         context = COALESCE(context, '{}'::jsonb) || jsonb_build_object(
           'reversal_reason', NULLIF(btrim(COALESCE(p_reason, '')), ''),
           'reversal_by', auth.uid(),
           'reversal_at', now()
         )
   WHERE id = v_redemption.id;

  UPDATE public.billing_coupon_claims
     SET status = 'cancelled',
         cancelled_at = now()
   WHERE applied_redemption_id = v_redemption.id
     AND status = 'applied';

  RETURN jsonb_build_object(
    'ok', true,
    'redemption_id', v_redemption.id,
    'fatura_id', v_invoice.id,
    'novo_desconto_centavos', v_new_discount,
    'novo_valor_centavos', v_new_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_my_billing_coupon_code(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_billing_coupon_on_signup(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_reverse_billing_coupon_redemption(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
