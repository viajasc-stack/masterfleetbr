-- Identificação operacional do veículo (prefixo interno da frota)

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS prefixo text;
