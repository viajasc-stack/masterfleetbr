CREATE OR REPLACE FUNCTION public.unapply_my_billing_coupon_code(
  p_fatura_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_fatura record;
  v_redemption public.billing_coupon_redemptions%ROWTYPE;
  v_new_discount bigint;
  v_new_final bigint;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT
    f.id,
    f.empresa_id,
    COALESCE(f.valor_bruto_centavos, f.valor_centavos, 0)::bigint AS valor_bruto_centavos,
    COALESCE(f.desconto_centavos, 0)::bigint AS desconto_centavos,
    COALESCE(f.desconto_detalhe, '{}'::jsonb) AS desconto_detalhe
  INTO v_fatura
  FROM public.faturas f
  WHERE f.empresa_id = v_empresa_id
    AND (
      (p_fatura_id IS NOT NULL AND f.id = p_fatura_id)
      OR (p_fatura_id IS NULL AND f.status = 'aberta')
    )
  ORDER BY f.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_fatura.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invoice_not_found');
  END IF;

  SELECT r.*
  INTO v_redemption
  FROM public.billing_coupon_redemptions r
  WHERE r.fatura_id = v_fatura.id
    AND r.empresa_id = v_empresa_id
    AND r.status = 'applied'
  ORDER BY r.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_redemption.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_applied_coupon', 'fatura_id', v_fatura.id);
  END IF;

  v_new_discount := GREATEST(COALESCE(v_fatura.desconto_centavos, 0) - COALESCE(v_redemption.discount_centavos, 0), 0);
  v_new_final := GREATEST(v_fatura.valor_bruto_centavos - v_new_discount, 0);

  UPDATE public.faturas
     SET desconto_centavos = v_new_discount,
         valor_centavos = v_new_final,
         desconto_detalhe = COALESCE(v_fatura.desconto_detalhe, '{}'::jsonb) || jsonb_build_object(
           'coupon_reversal', jsonb_build_object(
             'redemption_id', v_redemption.id,
             'reason', COALESCE(NULLIF(btrim(COALESCE(p_reason, '')), ''), 'unapplied_by_empresa'),
             'reversed_by', auth.uid(),
             'reversed_at', now(),
             'discount_reverted_centavos', v_redemption.discount_centavos
           )
         ),
         updated_at = now()
   WHERE id = v_fatura.id;

  UPDATE public.billing_coupon_redemptions
     SET status = 'cancelled',
         cancelled_at = now(),
         context = COALESCE(context, '{}'::jsonb) || jsonb_build_object(
           'reversal_reason', COALESCE(NULLIF(btrim(COALESCE(p_reason, '')), ''), 'unapplied_by_empresa'),
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
    'fatura_id', v_fatura.id,
    'novo_desconto_centavos', v_new_discount,
    'novo_valor_centavos', v_new_final
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unapply_my_billing_coupon_code(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
