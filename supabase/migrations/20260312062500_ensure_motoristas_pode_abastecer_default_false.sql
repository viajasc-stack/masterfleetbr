-- Garante permissão explícita de abastecimento no cadastro de motoristas
-- Padrão: não pode abastecer diretamente (false)

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS pode_abastecer boolean NOT NULL DEFAULT false;
