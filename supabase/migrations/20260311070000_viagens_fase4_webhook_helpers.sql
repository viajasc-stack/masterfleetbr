-- Helpers de status para pagamentos de viagem (usado por webhooks)

CREATE OR REPLACE FUNCTION public.rpc_viagens_marcar_pagamento_aprovado(
  p_pagamento_id uuid,
  p_provider_payment_id text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT NULL,
  p_pago_em timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagamento public.pagamentos_viagem;
BEGIN
  SELECT *
    INTO v_pagamento
  FROM public.pagamentos_viagem
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado';
  END IF;

  UPDATE public.pagamentos_viagem
     SET status = 'aprovado',
         provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
         provider_payload = COALESCE(p_provider_payload, provider_payload),
         pago_em = COALESCE(p_pago_em, now()),
         updated_at = now()
   WHERE id = p_pagamento_id;

  UPDATE public.pedidos_viagem
     SET status = 'pago',
         updated_at = now()
   WHERE id = v_pagamento.pedido_id;

  UPDATE public.passageiros_viagem
     SET status = 'confirmado',
         updated_at = now()
   WHERE pedido_id = v_pagamento.pedido_id
     AND status = 'reservado';
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_viagens_marcar_pagamento_recusado(
  p_pagamento_id uuid,
  p_provider_payment_id text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagamento public.pagamentos_viagem;
BEGIN
  SELECT *
    INTO v_pagamento
  FROM public.pagamentos_viagem
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado';
  END IF;

  UPDATE public.pagamentos_viagem
     SET status = 'recusado',
         provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
         provider_payload = COALESCE(p_provider_payload, provider_payload),
         updated_at = now()
   WHERE id = p_pagamento_id;

  UPDATE public.pedidos_viagem
     SET status = 'aguardando_pagamento',
         updated_at = now()
   WHERE id = v_pagamento.pedido_id
     AND status <> 'pago';
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_viagens_marcar_pagamento_aprovado(uuid, text, jsonb, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_viagens_marcar_pagamento_recusado(uuid, text, jsonb) TO authenticated;
