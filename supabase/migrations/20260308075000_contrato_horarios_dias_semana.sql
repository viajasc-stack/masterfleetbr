-- Permite configurar repetição por horário do contrato
ALTER TABLE IF EXISTS public.contrato_horarios
  ADD COLUMN IF NOT EXISTS dias_semana int[] NOT NULL DEFAULT '{}';

-- Backfill inicial: quando vazio, herda os dias do contrato
UPDATE public.contrato_horarios ch
   SET dias_semana = COALESCE(c.dias_semana, '{}')
  FROM public.contratos c
 WHERE c.id = ch.contrato_id
   AND (ch.dias_semana IS NULL OR cardinality(ch.dias_semana) = 0);

CREATE INDEX IF NOT EXISTS idx_contrato_horarios_dias_semana
  ON public.contrato_horarios USING gin (dias_semana);
