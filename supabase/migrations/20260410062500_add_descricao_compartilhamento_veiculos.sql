-- Descrição comercial do veículo para exibição em link de compartilhamento com clientes

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS descricao_compartilhamento text;

DROP FUNCTION IF EXISTS public.public_get_veiculo_share(uuid, text);

CREATE OR REPLACE FUNCTION public.public_get_veiculo_share(
  p_veiculo_id uuid,
  p_codigo_acesso text
)
RETURNS TABLE (
  id uuid,
  placa text,
  prefixo text,
  tipo text,
  marca text,
  modelo text,
  ano_fabricacao int,
  ano_modelo int,
  cor text,
  capacidade_passageiros int,
  combustivel text,
  arla32 boolean,
  km_atual numeric,
  status text,
  imagem_url text,
  observacoes text,
  descricao_compartilhamento text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.placa,
    v.prefixo,
    v.tipo,
    v.marca,
    v.modelo,
    v.ano_fabricacao,
    v.ano_modelo,
    v.cor,
    v.capacidade_passageiros,
    v.combustivel,
    v.arla32,
    v.km_atual,
    v.status,
    v.imagem_url,
    v.observacoes,
    v.descricao_compartilhamento
  FROM public.veiculos v
  WHERE v.id = p_veiculo_id
    AND v.codigo_acesso = p_codigo_acesso
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_veiculo_share(uuid, text) TO anon, authenticated;
