ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS contratante_eh_responsavel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS responsavel_viagem_nome text,
  ADD COLUMN IF NOT EXISTS responsavel_viagem_contato text;
