-- Permite gerar fatura manualmente pelo painel da própria empresa (uso em testes/suporte)

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
  v_vencimento := COALESCE(v_assinatura.proxima_cobranca, (current_date + 5));

  -- Evita duplicar fatura aberta no mesmo vencimento
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
