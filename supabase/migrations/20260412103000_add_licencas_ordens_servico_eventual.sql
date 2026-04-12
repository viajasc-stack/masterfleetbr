-- Adiciona colunas de licenças para fretamentos eventuais (ordens de serviço)

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS licenca_intermunicipal_url text,
  ADD COLUMN IF NOT EXISTS licenca_interestadual_url text;
