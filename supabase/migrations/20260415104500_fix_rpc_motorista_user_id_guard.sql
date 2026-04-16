-- Corrige lookup de motorista para bases que não possuem a coluna motoristas.user_id.
-- Importante: referência direta a coluna inexistente em SQL estático quebra em runtime,
-- mesmo dentro de condição. Por isso, separamos a consulta em dois caminhos.

CREATE OR REPLACE FUNCTION public.rpc_motorista_iniciar_os_com_conflito(
  p_os_id uuid,
  p_km_inicial numeric,
  p_assinatura_inicio_foto_url text DEFAULT NULL,
  p_force_encerrar_conflito boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_motorista_id uuid;
  v_motoristas_has_user_id boolean := false;

  v_os public.ordens_servico%ROWTYPE;
  v_conflito public.ordens_servico%ROWTYPE;
  v_conflito_motorista_diff_veiculo_id uuid;

  v_agora timestamptz := now();
  v_inicio_hash text := md5(random()::text || ':' || p_os_id::text || ':' || v_agora::text || ':inicio');
  v_fim_hash text := md5(random()::text || ':' || p_os_id::text || ':' || v_agora::text || ':fim-conflito');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_km_inicial IS NULL OR p_km_inicial < 0 THEN
    RAISE EXCEPTION 'KM inicial inválido.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute a
    WHERE a.attrelid = 'public.motoristas'::regclass
      AND a.attname = 'user_id'
      AND NOT a.attisdropped
  )
    INTO v_motoristas_has_user_id;

  IF v_motoristas_has_user_id THEN
    SELECT m.id
      INTO v_motorista_id
    FROM public.motoristas m
    WHERE m.auth_user_id = v_user_id
       OR m.user_id = v_user_id
    LIMIT 1;
  ELSE
    SELECT m.id
      INTO v_motorista_id
    FROM public.motoristas m
    WHERE m.auth_user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_motorista_id IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado para o usuário autenticado.';
  END IF;

  SELECT *
    INTO v_os
  FROM public.ordens_servico os
  WHERE os.id = p_os_id
    AND os.motorista_id = v_motorista_id
    AND lower(COALESCE(os.status, '')) = 'pendente'
  LIMIT 1;

  IF v_os.id IS NULL THEN
    RAISE EXCEPTION 'OS não encontrada, sem permissão ou sem status pendente.';
  END IF;

  -- Mantém regra: motorista não pode ter 2 OS em execução em veículos diferentes.
  SELECT os.id
    INTO v_conflito_motorista_diff_veiculo_id
  FROM public.ordens_servico os
  WHERE os.id <> v_os.id
    AND os.motorista_id = v_motorista_id
    AND lower(COALESCE(os.status, '')) IN ('em_execucao', 'em_andamento', 'iniciada')
    AND (
      v_os.veiculo_id IS NULL
      OR os.veiculo_id IS DISTINCT FROM v_os.veiculo_id
    )
  ORDER BY os.assinatura_inicio_em DESC NULLS LAST, os.created_at DESC
  LIMIT 1;

  IF v_conflito_motorista_diff_veiculo_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ação não permitida: já existe outra OS em andamento para este motorista em veículo diferente.';
  END IF;

  IF v_os.veiculo_id IS NOT NULL THEN
    SELECT *
      INTO v_conflito
    FROM public.ordens_servico os
    WHERE os.id <> v_os.id
      AND os.empresa_id = v_os.empresa_id
      AND os.veiculo_id = v_os.veiculo_id
      AND lower(COALESCE(os.status, '')) IN ('em_execucao', 'em_andamento', 'iniciada')
    ORDER BY os.assinatura_inicio_em DESC NULLS LAST, os.created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_conflito.id IS NOT NULL THEN
    UPDATE public.ordens_servico
       SET status = 'concluida',
           km_final = p_km_inicial,
           assinatura_fim_em = v_agora,
           assinatura_fim_hash = v_fim_hash,
           assinatura_fim_foto_url = COALESCE(
             NULLIF(v_conflito.assinatura_fim_foto_url, ''),
             NULLIF(v_conflito.assinatura_inicio_foto_url, ''),
             NULLIF(p_assinatura_inicio_foto_url, ''),
             'auto-encerramento-conflito'
           ),
           observacoes = CASE
             WHEN COALESCE(v_conflito.observacoes, '') = '' THEN
               'Encerrada automaticamente por conflito de veículo ao iniciar outra OS.'
             ELSE
               v_conflito.observacoes || E'\n' || 'Encerrada automaticamente por conflito de veículo ao iniciar outra OS.'
           END
     WHERE id = v_conflito.id;
  END IF;

  UPDATE public.ordens_servico
     SET status = 'em_execucao',
         km_inicial = p_km_inicial,
         assinatura_inicio_em = v_agora,
         assinatura_inicio_hash = v_inicio_hash,
         assinatura_inicio_foto_url = NULLIF(p_assinatura_inicio_foto_url, '')
   WHERE id = v_os.id;

  IF v_os.veiculo_id IS NOT NULL THEN
    UPDATE public.veiculos
       SET km_atual = p_km_inicial
     WHERE id = v_os.veiculo_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'requires_confirmation', false,
    'os_id', v_os.id,
    'veiculo_id', v_os.veiculo_id,
    'conflito_encerrado', (v_conflito.id IS NOT NULL),
    'conflito_os_id', v_conflito.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_motorista_iniciar_os_com_conflito(uuid, numeric, text, boolean) TO authenticated;
