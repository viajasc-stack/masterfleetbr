-- Adiciona colunas de licenças de fretamento em contratos

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS licenca_intermunicipal_url text,
  ADD COLUMN IF NOT EXISTS licenca_interestadual_url text;
