-- Corrige RLS em contrato_horarios ao inserir pelo frontend
-- Garante empresa_id automaticamente com base no contrato

CREATE OR REPLACE FUNCTION public.set_empresa_id_contrato_horarios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT c.empresa_id
    INTO v_empresa_id
    FROM public.contratos c
   WHERE c.id = NEW.contrato_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Contrato inválido para contrato_horarios.';
  END IF;

  NEW.empresa_id := v_empresa_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contrato_horarios_empresa ON public.contrato_horarios;

CREATE TRIGGER trg_contrato_horarios_empresa
  BEFORE INSERT ON public.contrato_horarios
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_contrato_horarios();
