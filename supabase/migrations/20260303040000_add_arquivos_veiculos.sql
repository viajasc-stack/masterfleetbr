-- Suporte a uploads de arquivos e galeria para veículos

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS documento_veiculo_url text,
  ADD COLUMN IF NOT EXISTS apolice_seguro_url text,
  ADD COLUMN IF NOT EXISTS vistoria_url text,
  ADD COLUMN IF NOT EXISTS galeria_urls text[] NOT NULL DEFAULT '{}';
