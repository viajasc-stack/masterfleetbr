-- Evita contratos duplicados quando cliente_id é NULL
-- (NULL = NULL não funciona com '='; usar IS NOT DISTINCT FROM)

DROP TRIGGER IF EXISTS trg_orcamentos_status_change ON public.orcamentos;
DROP FUNCTION IF EXISTS public.handle_orcamento_status_change();

CREATE OR REPLACE FUNCTION public.handle_orcamento_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  contrato_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'aprovado' AND OLD.status <> 'aprovado' THEN
      IF NEW.tipo = 'recorrencia' THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.contratos c
          WHERE c.empresa_id = NEW.empresa_id
            AND c.nome = NEW.nome
            AND c.cliente_id IS NOT DISTINCT FROM NEW.cliente_id
        ) THEN
          INSERT INTO public.contratos (empresa_id, cliente_id, nome, descricao, data_inicio, ativo)
          VALUES (NEW.empresa_id, NEW.cliente_id, NEW.nome, NEW.descricao, current_date, true)
          RETURNING id INTO contrato_id;
        END IF;
      ELSE
        INSERT INTO public.ordens_servico (empresa_id, cliente_id, observacoes, status, status_pagamento)
        VALUES (NEW.empresa_id, NEW.cliente_id, NEW.descricao, 'pendente', 'pendente');

        INSERT INTO public.notifications (empresa_id, nivel, titulo, mensagem, meta)
        VALUES (
          NEW.empresa_id,
          'info',
          'Ordem de Serviço criada a partir de Orçamento',
          'Uma ordem de serviço foi criada automaticamente a partir de um orçamento aprovado.',
          jsonb_build_object('orcamento_id', NEW.id)
        );
      END IF;
    ELSIF NEW.status = 'recusado' AND OLD.status <> 'recusado' THEN
      NEW.negociacao := true;
    END IF;

    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orcamentos_status_change
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_orcamento_status_change();
