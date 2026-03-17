-- Fase 4.3 (hardening): obrigatoriedade de checklist/evidências por etapa de OS

CREATE OR REPLACE FUNCTION public.os_checklist_stage_complete(
  p_os_id uuid,
  p_etapa text,
  p_item_codes text[]
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_done_count int;
  v_needed int;
BEGIN
  v_needed := COALESCE(array_length(p_item_codes, 1), 0);
  IF v_needed = 0 THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)::int
    INTO v_done_count
    FROM public.os_checklist_execucao c
   WHERE c.ordem_servico_id = p_os_id
     AND c.etapa = p_etapa
     AND c.item_codigo = ANY (p_item_codes)
     AND c.concluido = true;

  RETURN COALESCE(v_done_count, 0) >= v_needed;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_os_operational_closure_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
  v_pre_items text[];
  v_embarque_items text[];
  v_pos_items text[];
BEGIN
  IF TG_OP <> 'UPDATE' OR v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  BEGIN
    EXECUTE $sql$
      SELECT COALESCE(array_agg(c.item_codigo ORDER BY c.item_codigo), ARRAY[]::text[])
      FROM public.motorista_checklist_config c
      WHERE c.empresa_id = $1
        AND c.etapa = 'pre_partida'
        AND c.ativo = true
    $sql$
    INTO v_pre_items
    USING NEW.empresa_id;

    EXECUTE $sql$
      SELECT COALESCE(array_agg(c.item_codigo ORDER BY c.item_codigo), ARRAY[]::text[])
      FROM public.motorista_checklist_config c
      WHERE c.empresa_id = $1
        AND c.etapa = 'embarque'
        AND c.ativo = true
    $sql$
    INTO v_embarque_items
    USING NEW.empresa_id;

    EXECUTE $sql$
      SELECT COALESCE(array_agg(c.item_codigo ORDER BY c.item_codigo), ARRAY[]::text[])
      FROM public.motorista_checklist_config c
      WHERE c.empresa_id = $1
        AND c.etapa = 'pos_servico'
        AND c.ativo = true
    $sql$
    INTO v_pos_items
    USING NEW.empresa_id;
  EXCEPTION
    WHEN undefined_table THEN
      v_pre_items := ARRAY['documentos_ok', 'veiculo_inspecao', 'itens_seguranca'];
      v_embarque_items := ARRAY['contagem_passageiros', 'itinerario_alinhado', 'saida_registrada'];
      v_pos_items := ARRAY['desembarque_ok', 'vistoria_pos', 'evidencias_finais'];
  END;

  -- Ao iniciar execução, pré-partida + evidência de início são obrigatórios
  IF v_new_status IN ('em_execucao', 'em_andamento') AND v_old_status NOT IN ('em_execucao', 'em_andamento') THEN
    IF COALESCE(NULLIF(NEW.assinatura_inicio_foto_url, ''), '') = '' THEN
      RAISE EXCEPTION 'Não é possível iniciar OS sem evidência de início.';
    END IF;

    IF NOT public.os_checklist_stage_complete(NEW.id, 'pre_partida', v_pre_items) THEN
      RAISE EXCEPTION 'Não é possível iniciar OS: checklist de pré-partida incompleto.';
    END IF;
  END IF;

  -- Ao concluir/finalizar, checklist completo + evidência final são obrigatórios
  IF v_new_status IN ('concluida', 'finalizada') THEN
    IF COALESCE(NULLIF(NEW.assinatura_fim_foto_url, ''), '') = '' THEN
      RAISE EXCEPTION 'Não é possível concluir OS sem evidência final.';
    END IF;

    IF NOT public.os_checklist_stage_complete(NEW.id, 'pre_partida', v_pre_items)
       OR NOT public.os_checklist_stage_complete(NEW.id, 'embarque', v_embarque_items)
       OR NOT public.os_checklist_stage_complete(NEW.id, 'pos_servico', v_pos_items) THEN
      RAISE EXCEPTION 'Não é possível concluir OS: checklist operacional incompleto.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_operational_closure_rules ON public.ordens_servico;
CREATE TRIGGER trg_os_operational_closure_rules
  BEFORE UPDATE OF status ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_os_operational_closure_rules();
