-- Hotfix: garante coluna de vínculo entre contas_financeiras e entradas_estoque
-- para ambientes que receberam RPCs novas sem a migração 20260303072000.

ALTER TABLE public.contas_financeiras
  ADD COLUMN IF NOT EXISTS entrada_estoque_id uuid REFERENCES public.entradas_estoque(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_entrada_estoque_id
  ON public.contas_financeiras(entrada_estoque_id)
  WHERE entrada_estoque_id IS NOT NULL;
