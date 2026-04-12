-- Expande as participações do passageiro para suportar:
-- - sentido (IDA/VOLTA)
-- - dias da semana
-- - vigência própria por participação

ALTER TABLE public.contrato_passageiro_participacoes
  ADD COLUMN IF NOT EXISTS sentido text NOT NULL DEFAULT 'IDA',
  ADD COLUMN IF NOT EXISTS dias_semana int[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contrato_passageiro_participacoes_sentido_chk'
      AND conrelid = 'public.contrato_passageiro_participacoes'::regclass
  ) THEN
    ALTER TABLE public.contrato_passageiro_participacoes
      ADD CONSTRAINT contrato_passageiro_participacoes_sentido_chk
      CHECK (sentido IN ('IDA', 'VOLTA'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contrato_passageiro_participacoes_data_range_chk'
      AND conrelid = 'public.contrato_passageiro_participacoes'::regclass
  ) THEN
    ALTER TABLE public.contrato_passageiro_participacoes
      ADD CONSTRAINT contrato_passageiro_participacoes_data_range_chk
      CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contrato_passageiro_participacoes_dias_validos_chk'
      AND conrelid = 'public.contrato_passageiro_participacoes'::regclass
  ) THEN
    ALTER TABLE public.contrato_passageiro_participacoes
      ADD CONSTRAINT contrato_passageiro_participacoes_dias_validos_chk
      CHECK (
        dias_semana <@ ARRAY[0,1,2,3,4,5,6]
      );
  END IF;
END$$;

-- Backfill inicial: quando houver horário vinculado com dias definidos,
-- herdamos os dias do horário para a participação.
UPDATE public.contrato_passageiro_participacoes cpp
SET dias_semana = COALESCE(ch.dias_semana, '{}')
FROM public.contrato_horarios ch
WHERE cpp.contrato_horario_id = ch.id
  AND (cpp.dias_semana IS NULL OR cpp.dias_semana = '{}');

CREATE INDEX IF NOT EXISTS idx_cpp_sentido_ativo
  ON public.contrato_passageiro_participacoes (empresa_id, contrato_passageiro_id, sentido, ativo);

CREATE INDEX IF NOT EXISTS idx_cpp_dias_semana
  ON public.contrato_passageiro_participacoes USING gin (dias_semana);
