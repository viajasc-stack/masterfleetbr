-- Compatibiliza tabela ordens_servico com os campos usados no formulário (nova/edição)
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS roteiro text,
  ADD COLUMN IF NOT EXISTS qtd_passageiros integer,
  ADD COLUMN IF NOT EXISTS valor_sinal numeric,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS local_saida text,
  ADD COLUMN IF NOT EXISTS local_chegada text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid;
