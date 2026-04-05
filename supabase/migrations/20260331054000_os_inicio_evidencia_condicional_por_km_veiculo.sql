-- Ajuste operacional: evidência de início só é obrigatória quando
-- KM inicial informado divergir do KM atual do veículo.

CREATE OR REPLACE FUNCTION public.enforce_os_operational_closure_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
  v_km_atual_veiculo numeric;
  v_km_inicio_informado numeric := NEW.km_inicial;
  v_km_inicio_diferente boolean := true;
BEGIN
  IF TG_OP <> 'UPDATE' OR v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  -- Ao iniciar execução:
  -- - se KM inicial == KM atual do veículo -> não exige evidência de início
  -- - se diferente (ou sem referência de KM) -> exige evidência de início
  IF v_new_status IN ('em_execucao', 'em_andamento')
     AND v_old_status NOT IN ('em_execucao', 'em_andamento') THEN
    IF NEW.veiculo_id IS NOT NULL THEN
      SELECT v.km_atual
        INTO v_km_atual_veiculo
      FROM public.veiculos v
      WHERE v.id = NEW.veiculo_id
      LIMIT 1;
    END IF;

    IF v_km_inicio_informado IS NOT NULL AND v_km_atual_veiculo IS NOT NULL THEN
      v_km_inicio_diferente := v_km_inicio_informado IS DISTINCT FROM v_km_atual_veiculo;
    END IF;

    IF v_km_inicio_diferente
       AND COALESCE(NULLIF(NEW.assinatura_inicio_foto_url, ''), '') = '' THEN
      RAISE EXCEPTION 'Não é possível iniciar OS sem evidência de início quando o KM inicial difere do KM atual do veículo.';
    END IF;
  END IF;

  -- Ao concluir/finalizar, evidência final continua obrigatória.
  IF v_new_status IN ('concluida', 'finalizada') THEN
    IF COALESCE(NULLIF(NEW.assinatura_fim_foto_url, ''), '') = '' THEN
      RAISE EXCEPTION 'Não é possível concluir OS sem evidência final.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
