-- Ao cancelar OS eventual, remove lançamentos financeiros operacionais vinculados

CREATE OR REPLACE FUNCTION public.os_eventual_cancelada_remove_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Regra inicial: automatizar somente OS do tipo eventual
  IF NEW.tipo = 'eventual'
     AND NEW.status = 'cancelada'
     AND COALESCE(OLD.status, '') <> 'cancelada' THEN

    -- Remove apenas lançamentos de receita operacional da OS
    -- (não mexe em outros tipos/categorias para evitar efeitos colaterais)
    DELETE FROM public.contas_financeiras cf
    WHERE cf.os_id = NEW.id
      AND cf.tipo = 'receber'
      AND cf.categoria = 'ordem_servico'
      AND cf.status IN ('pendente', 'cancelado');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_eventual_cancelada_remove_financeiro ON public.ordens_servico;
CREATE TRIGGER trg_os_eventual_cancelada_remove_financeiro
  AFTER UPDATE OF status ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.os_eventual_cancelada_remove_financeiro();
