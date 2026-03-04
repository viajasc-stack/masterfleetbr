-- Compartilhamento público de veículo (link com código)

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS codigo_acesso text;

CREATE OR REPLACE FUNCTION public.gerar_codigo_veiculo()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo text;
BEGIN
  LOOP
    v_codigo := lpad((trunc(random() * 1000000))::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.veiculos v WHERE v.codigo_acesso = v_codigo
    );
  END LOOP;

  RETURN v_codigo;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_codigo_acesso_veiculos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.codigo_acesso, '') = '' THEN
    NEW.codigo_acesso := public.gerar_codigo_veiculo();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_veiculos_codigo_acesso ON public.veiculos;
CREATE TRIGGER trg_veiculos_codigo_acesso
  BEFORE INSERT ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.set_codigo_acesso_veiculos();

UPDATE public.veiculos
SET codigo_acesso = public.gerar_codigo_veiculo()
WHERE COALESCE(codigo_acesso, '') = '';

ALTER TABLE public.veiculos
  DROP CONSTRAINT IF EXISTS veiculos_codigo_acesso_digits_chk;

ALTER TABLE public.veiculos
  ADD CONSTRAINT veiculos_codigo_acesso_digits_chk
  CHECK (codigo_acesso ~ '^[0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_veiculos_codigo_acesso_unique
  ON public.veiculos(codigo_acesso);

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
  observacoes text
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
    v.observacoes
  FROM public.veiculos v
  WHERE v.id = p_veiculo_id
    AND v.codigo_acesso = p_codigo_acesso
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_veiculo_share(uuid, text) TO anon, authenticated;
