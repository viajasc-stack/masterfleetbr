-- Suporte a carnê/parcelamento em contas_financeiras

ALTER TABLE public.contas_financeiras
  ADD COLUMN IF NOT EXISTS carne_grupo_id text,
  ADD COLUMN IF NOT EXISTS parcela_numero int,
  ADD COLUMN IF NOT EXISTS parcela_total int,
  ADD COLUMN IF NOT EXISTS valor_total_carne numeric;

CREATE INDEX IF NOT EXISTS idx_contas_financeiras_carne_grupo
  ON public.contas_financeiras (empresa_id, carne_grupo_id);
