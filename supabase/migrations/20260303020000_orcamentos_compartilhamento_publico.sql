-- Campos adicionais para orçamento detalhado + compartilhamento público
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id),
  ADD COLUMN IF NOT EXISTS inicio_em timestamptz,
  ADD COLUMN IF NOT EXISTS retorno_em timestamptz,
  ADD COLUMN IF NOT EXISTS local_saida text,
  ADD COLUMN IF NOT EXISTS local_chegada text,
  ADD COLUMN IF NOT EXISTS codigo_acesso text;

-- Imagem principal do veículo para exibição no orçamento compartilhado
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS imagem_url text;

-- Código de acesso único (6 dígitos)
CREATE OR REPLACE FUNCTION public.gerar_codigo_orcamento()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
BEGIN
  LOOP
    v_codigo := lpad((floor(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.orcamentos o WHERE o.codigo_acesso = v_codigo
    );
  END LOOP;

  RETURN v_codigo;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_codigo_acesso_orcamentos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.codigo_acesso, '') = '' THEN
    NEW.codigo_acesso := public.gerar_codigo_orcamento();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orcamentos_codigo_acesso ON public.orcamentos;
CREATE TRIGGER trg_orcamentos_codigo_acesso
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_codigo_acesso_orcamentos();

UPDATE public.orcamentos
SET codigo_acesso = public.gerar_codigo_orcamento()
WHERE COALESCE(codigo_acesso, '') = '';

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_codigo_acesso_digits_chk
  CHECK (codigo_acesso ~ '^[0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_orcamentos_codigo_acesso_unique
  ON public.orcamentos(codigo_acesso);

-- Consulta pública para página de orçamento compartilhado
CREATE OR REPLACE FUNCTION public.public_get_orcamento_share(
  p_orcamento_id uuid,
  p_codigo_acesso text
)
RETURNS TABLE (
  id uuid,
  nome text,
  descricao text,
  tipo text,
  valor_centavos integer,
  status text,
  inicio_em timestamptz,
  retorno_em timestamptz,
  local_saida text,
  local_chegada text,
  cliente_nome text,
  veiculo_placa text,
  veiculo_marca text,
  veiculo_modelo text,
  veiculo_imagem_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.nome,
    o.descricao,
    o.tipo,
    o.valor_centavos,
    o.status,
    o.inicio_em,
    o.retorno_em,
    o.local_saida,
    o.local_chegada,
    c.nome AS cliente_nome,
    v.placa AS veiculo_placa,
    v.marca AS veiculo_marca,
    v.modelo AS veiculo_modelo,
    v.imagem_url AS veiculo_imagem_url
  FROM public.orcamentos o
  LEFT JOIN public.clientes c ON c.id = o.cliente_id
  LEFT JOIN public.veiculos v ON v.id = o.veiculo_id
  WHERE o.id = p_orcamento_id
    AND o.codigo_acesso = p_codigo_acesso
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_orcamento_share(uuid, text) TO anon, authenticated;
