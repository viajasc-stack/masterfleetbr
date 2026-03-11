-- Página pública de acompanhamento de pedido da viagem

CREATE OR REPLACE FUNCTION public.public_get_pedido_viagem_by_codigo(
  p_codigo text
)
RETURNS TABLE (
  pedido_id uuid,
  codigo_acompanhamento text,
  pedido_status public.pedido_viagem_status,
  pedido_expires_at timestamptz,
  valor_total numeric,
  comprador_nome text,
  viagem_id uuid,
  viagem_titulo text,
  viagem_data_ida date,
  viagem_cidade_destino text,
  pagamento_status public.pagamento_viagem_status,
  pagamento_gateway text,
  pagamento_metodo text,
  pagamento_pix_copia_cola text,
  pagamento_pix_qr_code text,
  pagamento_boleto_url text,
  passageiros_total integer,
  passageiros_confirmados integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT *
    FROM public.pedidos_viagem
    WHERE codigo_acompanhamento = upper(trim(p_codigo))
    LIMIT 1
  ),
  pay AS (
    SELECT pv.*
    FROM public.pagamentos_viagem pv
    JOIN p ON p.id = pv.pedido_id
    ORDER BY pv.created_at DESC
    LIMIT 1
  ),
  pax AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'confirmado')::int AS confirmados
    FROM public.passageiros_viagem
    WHERE pedido_id = (SELECT id FROM p)
  )
  SELECT
    p.id,
    p.codigo_acompanhamento,
    p.status,
    p.expires_at,
    p.valor_total,
    p.comprador_nome,
    v.id,
    v.titulo,
    v.data_ida,
    v.cidade_destino,
    pay.status,
    pay.gateway,
    pay.metodo,
    pay.pix_copia_cola,
    pay.pix_qr_code,
    pay.provider_payload->'payment'->>'invoiceUrl',
    COALESCE(pax.total, 0),
    COALESCE(pax.confirmados, 0)
  FROM p
  JOIN public.viagens v ON v.id = p.viagem_id
  LEFT JOIN pay ON true
  LEFT JOIN pax ON true;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_pedido_viagem_by_codigo(text) TO anon, authenticated;
