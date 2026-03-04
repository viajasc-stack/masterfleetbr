-- Compatibilidade da tabela contrato_horarios com o frontend atual
-- O frontend usa: hora, ordem, ativo

ALTER TABLE IF EXISTS public.contrato_horarios
  ADD COLUMN IF NOT EXISTS hora time;

-- Backfill: se existir a coluna legada "horario", copia para "hora"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'contrato_horarios'
       AND column_name = 'horario'
  ) THEN
    UPDATE public.contrato_horarios
       SET hora = horario
     WHERE hora IS NULL;
  END IF;
END
$$;

ALTER TABLE IF EXISTS public.contrato_horarios
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 1;

ALTER TABLE IF EXISTS public.contrato_horarios
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_contrato_horarios_contrato_ordem_hora
  ON public.contrato_horarios (contrato_id, ordem, hora);
