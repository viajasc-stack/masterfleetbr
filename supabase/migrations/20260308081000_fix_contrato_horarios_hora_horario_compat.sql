-- Compatibilidade entre colunas hora (frontend novo) e horario (legado)
-- Evita erro de NOT NULL em horario quando o frontend envia apenas "hora"

CREATE OR REPLACE FUNCTION public.sync_contrato_horarios_hora_horario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se veio só "hora", preenche "horario" para compatibilidade legada
  IF NEW.horario IS NULL AND NEW.hora IS NOT NULL THEN
    NEW.horario := NEW.hora;
  END IF;

  -- Se veio só "horario", preenche "hora" para frontend novo
  IF NEW.hora IS NULL AND NEW.horario IS NOT NULL THEN
    NEW.hora := NEW.horario;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_horarios_sync_hora_horario ON public.contrato_horarios;

CREATE TRIGGER trg_contrato_horarios_sync_hora_horario
  BEFORE INSERT OR UPDATE ON public.contrato_horarios
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contrato_horarios_hora_horario();
