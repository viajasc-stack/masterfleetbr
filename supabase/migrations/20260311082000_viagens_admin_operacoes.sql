-- Operações administrativas para fechamento do módulo Viagens

CREATE OR REPLACE FUNCTION public.rpc_viagens_confirmar_pagamento_manual(
  p_pagamento_id uuid,
  p_observacao text DEFAULT NULL
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
  WHERE id = p_pagamento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado';
  END IF;

  PERFORM public.rpc_viagens_marcar_pagamento_aprovado(
    p_pagamento_id,
    COALESCE(v_pagamento.provider_payment_id, 'MANUAL-' || replace(gen_random_uuid()::text, '-', '')),
    jsonb_build_object(
      'tipo', 'confirmacao_manual',
      'observacao', NULLIF(trim(COALESCE(p_observacao, '')), ''),
      'confirmado_em', now()
    ),
    now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_viagens_confirmar_pagamento_manual(uuid, text) TO authenticated;
