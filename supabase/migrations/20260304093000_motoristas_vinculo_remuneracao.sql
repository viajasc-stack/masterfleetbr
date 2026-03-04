-- Motoristas: vínculo de trabalho + regras de remuneração flexível

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS vinculo_trabalho text
    CHECK (vinculo_trabalho IN ('freelancer', 'contratado')),
  ADD COLUMN IF NOT EXISTS tipo_remuneracao text
    CHECK (tipo_remuneracao IN ('fixo_extra', 'fixo_banco_horas', 'por_os_executada', 'por_diaria')),
  ADD COLUMN IF NOT EXISTS salario_base numeric,
  ADD COLUMN IF NOT EXISTS valor_hora_extra numeric,
  ADD COLUMN IF NOT EXISTS banco_horas_saldo numeric,
  ADD COLUMN IF NOT EXISTS valor_por_os numeric,
  ADD COLUMN IF NOT EXISTS valor_diaria numeric,
  ADD COLUMN IF NOT EXISTS observacoes_remuneracao text;
