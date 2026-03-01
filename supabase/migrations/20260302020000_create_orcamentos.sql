-- Create orcamentos table for quotes/estimates
CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id),
  nome text,
  descricao text,
  tipo text NOT NULL DEFAULT 'eventual' CHECK (tipo IN ('recorrencia','eventual')),
  valor_centavos integer,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  negociacao boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamentos_empresa" ON public.orcamentos USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "orcamentos_insert" ON public.orcamentos FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "orcamentos_update" ON public.orcamentos FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "orcamentos_delete" ON public.orcamentos FOR DELETE USING (empresa_id = public.minha_empresa_id());

-- Set empresa_id automatically from security context
CREATE OR REPLACE FUNCTION public.set_empresa_id_orcamentos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.empresa_id := public.minha_empresa_id();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orcamentos_empresa
  BEFORE INSERT ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_orcamentos();

-- Handle status transitions: create contrato or ordem_servico on approval, mark negociacao on refusal
CREATE OR REPLACE FUNCTION public.handle_orcamento_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  contrato_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'aprovado' AND OLD.status <> 'aprovado' THEN
      IF NEW.tipo = 'recorrencia' THEN
        -- Create contrato if not exists (simple dedupe by nome+cliente)
        IF NOT EXISTS (SELECT 1 FROM public.contratos c WHERE c.empresa_id = NEW.empresa_id AND c.cliente_id = NEW.cliente_id AND c.nome = NEW.nome) THEN
          INSERT INTO public.contratos (empresa_id, cliente_id, nome, descricao, data_inicio, ativo)
          VALUES (NEW.empresa_id, NEW.cliente_id, NEW.nome, NEW.descricao, current_date, true)
          RETURNING id INTO contrato_id;
        END IF;
      ELSE
        -- Eventual freight: create an ordem_servico and a notification for admin
        INSERT INTO public.ordens_servico (empresa_id, cliente_id, descricao, status, status_pagamento)
        VALUES (NEW.empresa_id, NEW.cliente_id, NEW.descricao, 'pendente', 'pendente');

        -- create notification for admins
        INSERT INTO public.notifications (empresa_id, nivel, titulo, mensagem, meta)
        VALUES (NEW.empresa_id, 'info', 'Ordem de Serviço criada a partir de Orçamento',
          'Uma ordem de serviço foi criada automaticamente a partir de um orçamento aprovado.', jsonb_build_object('orcamento_id', NEW.id));
      END IF;
    ELSIF NEW.status = 'recusado' AND OLD.status <> 'recusado' THEN
      -- mark for negotiation
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
