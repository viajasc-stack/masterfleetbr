-- Adiciona colunas faltantes no cadastro de veículos
-- compatível com UI atual (combustivel, validade_documento, validade_seguro)

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS combustivel text,
  ADD COLUMN IF NOT EXISTS validade_documento date,
  ADD COLUMN IF NOT EXISTS validade_seguro date;

-- Nenhuma alteração necessária em RLS/policies e triggers,
-- pois continuam válidos para a tabela.
