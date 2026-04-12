-- Nome da rota por horário no fretamento recorrente

ALTER TABLE IF EXISTS public.contrato_horarios
  ADD COLUMN IF NOT EXISTS rota_nome text;

-- Backfill para registros antigos
UPDATE public.contrato_horarios
   SET rota_nome = COALESCE(
     NULLIF(rota_nome, ''),
     NULLIF(TRIM(CONCAT_WS(' - ', origem, destino)), ''),
     'Rota não informada'
   )
 WHERE rota_nome IS NULL OR rota_nome = '';

ALTER TABLE IF EXISTS public.contrato_horarios
  ALTER COLUMN rota_nome SET NOT NULL;

ALTER TABLE IF EXISTS public.contrato_horarios
  ALTER COLUMN rota_nome SET DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_contrato_horarios_contrato_rota_nome
  ON public.contrato_horarios (contrato_id, rota_nome);
