-- Alinha regra global de OS em execução com a exceção operacional:
-- - mantém bloqueio para motorista com OS em execução em veículo diferente;
-- - permite coexistência temporária no mesmo veículo para o fluxo de autoencerramento da RPC.

CREATE OR REPLACE FUNCTION public.enforce_os_business_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
  v_is_running_new boolean := v_new_status IN ('em_andamento', 'em_execucao', 'iniciada');
  v_is_running_old boolean := v_old_status IN ('em_andamento', 'em_execucao', 'iniciada');
  v_data_servico date;
BEGIN
  -- Regra 1: não iniciar/retomar OS futura
  IF v_is_running_new AND NOT v_is_running_old THEN
    BEGIN
      v_data_servico := NULLIF(to_jsonb(NEW)->>'data_servico', '')::date;
    EXCEPTION WHEN others THEN
      v_data_servico := NULL;
    END;

    IF v_data_servico IS NOT NULL AND v_data_servico > CURRENT_DATE THEN
      RAISE EXCEPTION 'Ação não permitida: não é possível iniciar OS futura.';
    END IF;

    -- Regra 2: bloquear apenas quando já existir OS em execução para o mesmo motorista
    -- em veículo diferente (ou quando NEW.veiculo_id estiver nulo).
    IF NEW.motorista_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.ordens_servico os
        WHERE os.motorista_id = NEW.motorista_id
          AND os.id <> NEW.id
          AND lower(COALESCE(os.status, '')) IN ('em_andamento', 'em_execucao', 'iniciada')
          AND (
            NEW.veiculo_id IS NULL
            OR os.veiculo_id IS DISTINCT FROM NEW.veiculo_id
          )
      ) THEN
        RAISE EXCEPTION 'Ação não permitida: já existe outra OS em andamento para este motorista em veículo diferente.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
