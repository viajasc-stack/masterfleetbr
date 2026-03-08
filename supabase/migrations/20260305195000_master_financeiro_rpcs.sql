-- RPC para painel financeiro master (visão global de faturas)

CREATE OR REPLACE FUNCTION public.master_list_faturas(
  p_limit int DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  empresa_nome text,
  valor_centavos bigint,
  status text,
  vencimento date,
  created_at timestamptz,
  mp_payment_id text
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
    f.id,
    f.empresa_id,
    e.nome AS empresa_nome,
    f.valor_centavos,
    f.status,
    f.vencimento,
    f.created_at,
    f.mp_payment_id
  FROM public.faturas f
  LEFT JOIN public.empresas e ON e.id = f.empresa_id
  ORDER BY f.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;
