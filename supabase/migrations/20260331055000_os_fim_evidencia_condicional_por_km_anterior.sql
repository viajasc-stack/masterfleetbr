-- Regra operacional: evidência final só obrigatória quando
-- KM final informado for menor que o último KM final já registrado para o motorista.
-- Também mantém regra de início: evidência só quando KM inicial divergir do KM atual do veículo.

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

  v_ultimo_km_registrado numeric;
  v_km_final_abaixo_ultimo boolean := false;
BEGIN
  IF TG_OP <> 'UPDATE' OR v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  -- Início da execução: evidência somente quando houver divergência com km_atual do veículo
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

  -- Conclusão/finalização: evidência final somente se km_final < último km_final já registrado
  IF v_new_status IN ('concluida', 'finalizada') THEN
    IF NEW.motorista_id IS NOT NULL THEN
      SELECT os.km_final
        INTO v_ultimo_km_registrado
      FROM public.ordens_servico os
      WHERE os.motorista_id = NEW.motorista_id
        AND os.id <> NEW.id
        AND os.km_final IS NOT NULL
      ORDER BY os.assinatura_fim_em DESC NULLS LAST, os.created_at DESC
      LIMIT 1;
    END IF;

    IF NEW.km_final IS NOT NULL AND v_ultimo_km_registrado IS NOT NULL THEN
      v_km_final_abaixo_ultimo := NEW.km_final < v_ultimo_km_registrado;
    END IF;

    IF v_km_final_abaixo_ultimo
       AND COALESCE(NULLIF(NEW.assinatura_fim_foto_url, ''), '') = '' THEN
      RAISE EXCEPTION 'Não é possível concluir OS sem evidência final quando o KM final é menor que o último registrado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
