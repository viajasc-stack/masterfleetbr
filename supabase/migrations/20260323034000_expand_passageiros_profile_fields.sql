-- Expande cadastro de passageiros para perfil completo (web)

ALTER TABLE public.passageiros
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_nome text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_telefone text,
  ADD COLUMN IF NOT EXISTS observacoes_medicas text;

CREATE INDEX IF NOT EXISTS idx_passageiros_email ON public.passageiros(empresa_id, email);
CREATE INDEX IF NOT EXISTS idx_passageiros_nome ON public.passageiros(empresa_id, nome);
