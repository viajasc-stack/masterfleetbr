-- Prepara integração OS -> passageiros (web/mobile)

CREATE OR REPLACE FUNCTION public.rpc_os_passageiros_detalhes(
  p_os_id uuid
)
RETURNS TABLE (
  passageiro_id uuid,
  nome text,
  telefone text,
  cpf text,
  status text,
  contato_emergencia_nome text,
  contato_emergencia_telefone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.passageiro_id,
    p.nome,
    p.telefone,
    p.cpf,
    p.status,
    p.contato_emergencia_nome,
    p.contato_emergencia_telefone
  FROM public.os_passageiros_presenca pr
  JOIN public.passageiros p ON p.id = pr.passageiro_id
  WHERE pr.os_id = p_os_id
  ORDER BY p.nome;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_os_passageiros_detalhes(uuid) TO authenticated;
