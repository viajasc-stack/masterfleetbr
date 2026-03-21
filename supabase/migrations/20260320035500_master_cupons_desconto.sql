-- Sistema de cupons de desconto (Painel Master)

CREATE TABLE IF NOT EXISTS public.billing_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value numeric(12,4) NOT NULL CHECK (discount_value > 0),
  min_invoice_amount_centavos bigint NOT NULL DEFAULT 0 CHECK (min_invoice_amount_centavos >= 0),
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  max_redemptions_per_empresa integer NOT NULL DEFAULT 1 CHECK (max_redemptions_per_empresa > 0),
  stackable boolean NOT NULL DEFAULT false,
  first_invoice_only boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_billing_coupons_active ON public.billing_coupons (active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_coupons_code ON public.billing_coupons (code);

CREATE TABLE IF NOT EXISTS public.billing_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.billing_coupons(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fatura_id uuid NOT NULL REFERENCES public.faturas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'cancelled')),
  discount_centavos bigint NOT NULL CHECK (discount_centavos >= 0),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_billing_coupon_redemptions_coupon ON public.billing_coupon_redemptions (coupon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_coupon_redemptions_empresa ON public.billing_coupon_redemptions (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_coupon_redemptions_fatura ON public.billing_coupon_redemptions (fatura_id);

CREATE OR REPLACE FUNCTION public.master_list_billing_coupons()
RETURNS TABLE (
  id uuid,
  code text,
  title text,
  description text,
  discount_type text,
  discount_value numeric,
  min_invoice_amount_centavos bigint,
  max_redemptions integer,
  max_redemptions_per_empresa integer,
  stackable boolean,
  first_invoice_only boolean,
  active boolean,
  valid_from timestamptz,
  valid_until timestamptz,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  total_redemptions bigint,
  total_discount_centavos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.code,
    c.title,
    c.description,
    c.discount_type,
    c.discount_value,
    c.min_invoice_amount_centavos,
    c.max_redemptions,
    c.max_redemptions_per_empresa,
    c.stackable,
    c.first_invoice_only,
    c.active,
    c.valid_from,
    c.valid_until,
    c.metadata,
    c.created_by,
    c.created_at,
    c.updated_at,
    COALESCE(r.total_redemptions, 0) AS total_redemptions,
    COALESCE(r.total_discount_centavos, 0) AS total_discount_centavos
  FROM public.billing_coupons c
  LEFT JOIN (
    SELECT
      coupon_id,
      COUNT(*) FILTER (WHERE status = 'applied')::bigint AS total_redemptions,
      COALESCE(SUM(discount_centavos) FILTER (WHERE status = 'applied'), 0)::bigint AS total_discount_centavos
    FROM public.billing_coupon_redemptions
    GROUP BY coupon_id
  ) r ON r.coupon_id = c.id
  ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_billing_coupon(
  p_id uuid DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_discount_type text DEFAULT 'fixed',
  p_discount_value numeric DEFAULT 0,
  p_min_invoice_amount_centavos bigint DEFAULT 0,
  p_max_redemptions integer DEFAULT NULL,
  p_max_redemptions_per_empresa integer DEFAULT 1,
  p_stackable boolean DEFAULT false,
  p_first_invoice_only boolean DEFAULT false,
  p_active boolean DEFAULT true,
  p_valid_from timestamptz DEFAULT NULL,
  p_valid_until timestamptz DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_code text := upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9_-]', '', 'g'));
  v_type text := lower(COALESCE(p_discount_type, 'fixed'));
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF btrim(v_code) = '' THEN
    RAISE EXCEPTION 'coupon_code_required';
  END IF;

  IF btrim(COALESCE(p_title, '')) = '' THEN
    RAISE EXCEPTION 'coupon_title_required';
  END IF;

  IF v_type NOT IN ('fixed', 'percent') THEN
    RAISE EXCEPTION 'coupon_discount_type_invalid';
  END IF;

  IF COALESCE(p_discount_value, 0) <= 0 THEN
    RAISE EXCEPTION 'coupon_discount_value_invalid';
  END IF;

  IF v_type = 'percent' AND p_discount_value > 100 THEN
    RAISE EXCEPTION 'coupon_discount_percent_above_100';
  END IF;

  IF p_valid_from IS NOT NULL AND p_valid_until IS NOT NULL AND p_valid_until < p_valid_from THEN
    RAISE EXCEPTION 'coupon_invalid_validity_range';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.billing_coupons (
      code,
      title,
      description,
      discount_type,
      discount_value,
      min_invoice_amount_centavos,
      max_redemptions,
      max_redemptions_per_empresa,
      stackable,
      first_invoice_only,
      active,
      valid_from,
      valid_until,
      metadata,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      v_code,
      btrim(p_title),
      NULLIF(btrim(COALESCE(p_description, '')), ''),
      v_type,
      p_discount_value,
      GREATEST(COALESCE(p_min_invoice_amount_centavos, 0), 0),
      p_max_redemptions,
      GREATEST(COALESCE(p_max_redemptions_per_empresa, 1), 1),
      COALESCE(p_stackable, false),
      COALESCE(p_first_invoice_only, false),
      COALESCE(p_active, true),
      p_valid_from,
      p_valid_until,
      COALESCE(p_metadata, '{}'::jsonb),
      auth.uid(),
      now(),
      now()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.billing_coupons
       SET code = v_code,
           title = btrim(p_title),
           description = NULLIF(btrim(COALESCE(p_description, '')), ''),
           discount_type = v_type,
           discount_value = p_discount_value,
           min_invoice_amount_centavos = GREATEST(COALESCE(p_min_invoice_amount_centavos, 0), 0),
           max_redemptions = p_max_redemptions,
           max_redemptions_per_empresa = GREATEST(COALESCE(p_max_redemptions_per_empresa, 1), 1),
           stackable = COALESCE(p_stackable, false),
           first_invoice_only = COALESCE(p_first_invoice_only, false),
           active = COALESCE(p_active, active),
           valid_from = p_valid_from,
           valid_until = p_valid_until,
           metadata = COALESCE(p_metadata, '{}'::jsonb),
           updated_at = now()
     WHERE id = p_id
     RETURNING id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'coupon_not_saved';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_delete_billing_coupon(
  p_coupon_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.billing_coupons
   WHERE id = p_coupon_id;

  RETURN FOUND;
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
DECLARE
  v_coupon public.billing_coupons%ROWTYPE;
  v_fatura record;
  v_existing_company_uses integer := 0;
  v_total_redemptions bigint := 0;
  v_discount_centavos bigint := 0;
  v_now timestamptz := now();
  v_final_centavos bigint := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

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
             'applied_by', auth.uid(),
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
      'observacao', NULLIF(btrim(COALESCE(p_observacao, '')), '')
    ),
    auth.uid(),
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code,
    'fatura_id', v_fatura.id,
    'discount_centavos', v_discount_centavos,
    'valor_final_centavos', v_final_centavos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_billing_coupon_redemptions(
  p_coupon_id uuid DEFAULT NULL,
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  coupon_id uuid,
  coupon_code text,
  empresa_id uuid,
  empresa_nome text,
  fatura_id uuid,
  status text,
  discount_centavos bigint,
  created_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.coupon_id,
    c.code AS coupon_code,
    r.empresa_id,
    e.nome AS empresa_nome,
    r.fatura_id,
    r.status,
    r.discount_centavos,
    r.created_at,
    r.created_by
  FROM public.billing_coupon_redemptions r
  JOIN public.billing_coupons c ON c.id = r.coupon_id
  LEFT JOIN public.empresas e ON e.id = r.empresa_id
  WHERE p_coupon_id IS NULL OR r.coupon_id = p_coupon_id
  ORDER BY r.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.master_list_billing_coupons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_billing_coupon(uuid, text, text, text, text, numeric, bigint, integer, integer, boolean, boolean, boolean, timestamptz, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_delete_billing_coupon(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_apply_billing_coupon_to_empresa(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_billing_coupon_redemptions(uuid, int) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
