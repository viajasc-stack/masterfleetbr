-- Novo fluxo de status para orçamentos e ações públicas por código

-- 1) Remove qualquer check antigo de status (antes de atualizar valores)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'orcamentos'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.orcamentos DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- 2) Ajusta valores antigos
UPDATE public.orcamentos
SET status = 'criado'
WHERE status = 'pendente' OR status IS NULL;

UPDATE public.orcamentos
SET status = 'negado'
WHERE status = 'recusado';

-- 3) Recria check de status com os novos valores
ALTER TABLE public.orcamentos
  ALTER COLUMN status SET DEFAULT 'criado';

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_status_chk
  CHECK (status IN ('criado', 'enviado', 'aguardando_resposta', 'aprovado', 'negado'));

-- 4) Trigger de negócio: troca "recusado" por "negado"
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
    ELSIF NEW.status = 'negado' AND OLD.status <> 'negado' THEN
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

-- 5) RPC pública para marcar status ao abrir (aguardando resposta)
CREATE OR REPLACE FUNCTION public.public_mark_orcamento_opened(
  p_orcamento_id uuid,
  p_codigo_acesso text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orcamentos o
  SET status = 'aguardando_resposta', updated_at = now()
  WHERE o.id = p_orcamento_id
    AND o.codigo_acesso = p_codigo_acesso
    AND o.status IN ('criado', 'enviado');

  RETURN FOUND;
END;
$$;

-- 6) RPC pública para cliente aprovar/recusar
CREATE OR REPLACE FUNCTION public.public_respond_orcamento(
  p_orcamento_id uuid,
  p_codigo_acesso text,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('aprovado', 'negado') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  UPDATE public.orcamentos o
  SET status = p_status, updated_at = now()
  WHERE o.id = p_orcamento_id
    AND o.codigo_acesso = p_codigo_acesso
    AND o.status IN ('criado', 'enviado', 'aguardando_resposta');

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_mark_orcamento_opened(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_respond_orcamento(uuid, text, text) TO anon, authenticated;
