-- Controle futuro de consumo de ARLA32 por veículo

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS arla32 boolean NOT NULL DEFAULT false;
