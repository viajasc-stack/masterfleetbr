-- Restrições de qualidade de dados para passageiros

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'passageiros_uf_len_chk'
      AND conrelid = 'public.passageiros'::regclass
  ) THEN
    ALTER TABLE public.passageiros
      ADD CONSTRAINT passageiros_uf_len_chk
      CHECK (uf IS NULL OR char_length(trim(uf)) = 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'passageiros_email_format_chk'
      AND conrelid = 'public.passageiros'::regclass
  ) THEN
    ALTER TABLE public.passageiros
      ADD CONSTRAINT passageiros_email_format_chk
      CHECK (
        email IS NULL
        OR email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
      );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_passageiros_cpf_empresa ON public.passageiros(empresa_id, cpf);
