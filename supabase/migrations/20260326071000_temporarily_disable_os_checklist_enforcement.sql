-- Hotfix temporário (pedido operacional): desativar validação de checklist na transição de status da OS.
-- Mantemos somente obrigatoriedade de evidência fotográfica de início/fim.

CREATE OR REPLACE FUNCTION public.enforce_os_operational_closure_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
BEGIN
  IF TG_OP <> 'UPDATE' OR v_new_status = v_old_status THEN
    RETURN NEW;
  END IF;

  -- Ao iniciar execução, somente evidência de início é obrigatória.
  IF v_new_status IN ('em_execucao', 'em_andamento')
     AND v_old_status NOT IN ('em_execucao', 'em_andamento') THEN
    IF COALESCE(NULLIF(NEW.assinatura_inicio_foto_url, ''), '') = '' THEN
      RAISE EXCEPTION 'Não é possível iniciar OS sem evidência de início.';
    END IF;
  END IF;

  -- Ao concluir/finalizar, somente evidência final é obrigatória.
  IF v_new_status IN ('concluida', 'finalizada') THEN
    IF COALESCE(NULLIF(NEW.assinatura_fim_foto_url, ''), '') = '' THEN
      RAISE EXCEPTION 'Não é possível concluir OS sem evidência final.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
