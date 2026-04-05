ALTER TABLE public.pedidos_compra
  ADD COLUMN IF NOT EXISTS numero_nota text;

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_numero_nota
  ON public.pedidos_compra (empresa_id, numero_nota)
  WHERE numero_nota IS NOT NULL;
