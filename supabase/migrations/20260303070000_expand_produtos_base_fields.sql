-- Fase 1 Inventário (cadastro base de itens)
-- Expande public.produtos com campos estruturantes para escala ERP.

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tipo_item text,
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS codigo_fornecedor text,
  ADD COLUMN IF NOT EXISTS controla_estoque boolean,
  ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL;

UPDATE public.produtos
SET
  tipo_item = COALESCE(tipo_item, 'peca'),
  controla_estoque = COALESCE(controla_estoque, true);

ALTER TABLE public.produtos
  ALTER COLUMN tipo_item SET DEFAULT 'peca',
  ALTER COLUMN tipo_item SET NOT NULL,
  ALTER COLUMN controla_estoque SET DEFAULT true,
  ALTER COLUMN controla_estoque SET NOT NULL;

ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_tipo_item_check;

ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_tipo_item_check
  CHECK (tipo_item IN ('peca', 'pneu', 'combustivel', 'oleo_lubrificante', 'acessorio', 'limpeza', 'servico_terceirizado', 'outro'));

CREATE INDEX IF NOT EXISTS idx_produtos_empresa_tipo_item ON public.produtos(empresa_id, tipo_item);

CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_empresa_codigo_interno_uniq
  ON public.produtos(empresa_id, codigo_interno)
  WHERE codigo_interno IS NOT NULL AND btrim(codigo_interno) <> '';
