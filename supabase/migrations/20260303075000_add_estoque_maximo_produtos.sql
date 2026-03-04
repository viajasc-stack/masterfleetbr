-- Suporte a capacidade máxima de estoque por produto (ex.: tanque de combustível)

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS estoque_maximo numeric;

ALTER TABLE public.produtos
  DROP CONSTRAINT IF EXISTS produtos_estoque_maximo_check;

ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_estoque_maximo_check
  CHECK (estoque_maximo IS NULL OR estoque_maximo >= 0);
