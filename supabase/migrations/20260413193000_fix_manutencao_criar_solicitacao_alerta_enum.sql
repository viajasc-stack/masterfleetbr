-- Corrige erro no RPC de criação de solicitação de manutenção no app motorista
-- Causa raiz: função inseria alerta com tipo 'nova_solicitacao',
-- mas esse valor não existia no enum alerta_manutencao_tipo.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'alerta_manutencao_tipo'
      AND e.enumlabel = 'nova_solicitacao'
  ) THEN
    ALTER TYPE public.alerta_manutencao_tipo ADD VALUE 'nova_solicitacao';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.manutencao_criar_solicitacao(
  p_veiculo_id uuid,
  p_categoria text,
  p_titulo text,
  p_descricao text,
  p_prioridade text DEFAULT 'media',
  p_origem text DEFAULT 'motorista',
  p_km_atual numeric DEFAULT NULL,
  p_fotos text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_motorista_id uuid;
  v_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada.';
  END IF;

  -- Tenta identificar motorista pelo auth.uid() (compatível com bases antigas e novas)
  SELECT id
    INTO v_motorista_id
  FROM public.motoristas
  WHERE auth_user_id = auth.uid()
     OR user_id = auth.uid()
  LIMIT 1;

  INSERT INTO public.manutencao_solicitacoes (
    empresa_id, veiculo_id, motorista_id, categoria, titulo, descricao,
    prioridade, origem, km_atual, fotos, created_by
  ) VALUES (
    v_empresa_id, p_veiculo_id, v_motorista_id,
    p_categoria::public.manutencao_categoria,
    p_titulo, p_descricao,
    p_prioridade::public.manutencao_prioridade,
    p_origem::public.solicitacao_manutencao_origem,
    p_km_atual, p_fotos, auth.uid()
  ) RETURNING id INTO v_id;

  -- Alerta não deve bloquear criação da solicitação
  BEGIN
    INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, tipo, severidade, titulo, mensagem)
    VALUES (
      v_empresa_id,
      p_veiculo_id,
      'nova_solicitacao',
      CASE
        WHEN p_prioridade = 'alta' OR p_prioridade = 'critica'
          THEN 'alta'::public.alerta_manutencao_severidade
        ELSE 'media'::public.alerta_manutencao_severidade
      END,
      'Nova solicitação de manutenção',
      p_titulo
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_id;
END;
$$;
