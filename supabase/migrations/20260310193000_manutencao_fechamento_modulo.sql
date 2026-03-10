-- Fechamento do módulo de manutenção
-- Blocos: compras, permissões/alçadas, financeiro, preventivas e indicadores

-- 1) Compras vinculadas à manutenção
CREATE TABLE IF NOT EXISTS public.manutencao_requisicoes_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  manutencao_id uuid NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  item_descricao text NOT NULL,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_unitario_previsto numeric,
  valor_total_previsto numeric,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada', 'em_cotacao', 'aprovada', 'comprada', 'recebida', 'cancelada')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manutencao_requisicoes_compra ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_requisicoes_compra' AND policyname = 'manutencao_requisicoes_compra_empresa'
  ) THEN
    CREATE POLICY "manutencao_requisicoes_compra_empresa"
      ON public.manutencao_requisicoes_compra
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_requisicoes_compra' AND policyname = 'manutencao_requisicoes_compra_insert'
  ) THEN
    CREATE POLICY "manutencao_requisicoes_compra_insert"
      ON public.manutencao_requisicoes_compra
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_requisicoes_compra' AND policyname = 'manutencao_requisicoes_compra_update'
  ) THEN
    CREATE POLICY "manutencao_requisicoes_compra_update"
      ON public.manutencao_requisicoes_compra
      FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_manutencao_requisicao_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT m.empresa_id INTO v_empresa_id
  FROM public.manutencoes m
  WHERE m.id = NEW.manutencao_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Manutenção não encontrada para requisição de compra.';
  END IF;

  NEW.empresa_id := v_empresa_id;
  NEW.valor_total_previsto := COALESCE(NEW.valor_total_previsto, COALESCE(NEW.valor_unitario_previsto, 0) * NEW.quantidade);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencao_requisicoes_compra_empresa ON public.manutencao_requisicoes_compra;
CREATE TRIGGER trg_manutencao_requisicoes_compra_empresa
  BEFORE INSERT OR UPDATE ON public.manutencao_requisicoes_compra
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_manutencao_requisicao_compra();

-- 2) Alçadas de aprovação e permissões
CREATE TABLE IF NOT EXISTS public.manutencao_alcadas_aprovacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  perfil text NOT NULL CHECK (perfil IN ('dono', 'admin', 'usuario', 'motorista')),
  valor_maximo numeric,
  pode_aprovar boolean NOT NULL DEFAULT false,
  pode_diagnosticar boolean NOT NULL DEFAULT false,
  pode_reservar_estoque boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, perfil)
);

ALTER TABLE public.manutencao_alcadas_aprovacao ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_alcadas_aprovacao' AND policyname = 'manutencao_alcadas_empresa'
  ) THEN
    CREATE POLICY "manutencao_alcadas_empresa"
      ON public.manutencao_alcadas_aprovacao
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_alcadas_aprovacao' AND policyname = 'manutencao_alcadas_insert'
  ) THEN
    CREATE POLICY "manutencao_alcadas_insert"
      ON public.manutencao_alcadas_aprovacao
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_alcadas_aprovacao' AND policyname = 'manutencao_alcadas_update'
  ) THEN
    CREATE POLICY "manutencao_alcadas_update"
      ON public.manutencao_alcadas_aprovacao
      FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.seed_default_manutencao_alcadas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.manutencao_alcadas_aprovacao (empresa_id, perfil, valor_maximo, pode_aprovar, pode_diagnosticar, pode_reservar_estoque)
  VALUES
    (v_empresa_id, 'usuario', 300, true, true, false),
    (v_empresa_id, 'admin', 1500, true, true, true),
    (v_empresa_id, 'dono', NULL, true, true, true),
    (v_empresa_id, 'motorista', 0, false, false, false)
  ON CONFLICT (empresa_id, perfil) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manutencao_aprovar(
  p_manutencao_id uuid,
  p_aprovado boolean,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_role text;
  v_custo numeric;
  v_alcada public.manutencao_alcadas_aprovacao;
BEGIN
  SELECT m.empresa_id, COALESCE(m.previsao_custo, m.custo_total, 0)
    INTO v_empresa_id, v_custo
  FROM public.manutencoes m
  WHERE m.id = p_manutencao_id
    AND m.empresa_id = public.minha_empresa_id();

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Manutenção não encontrada para aprovação.';
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  PERFORM public.seed_default_manutencao_alcadas();

  SELECT * INTO v_alcada
  FROM public.manutencao_alcadas_aprovacao a
  WHERE a.empresa_id = v_empresa_id
    AND a.perfil = COALESCE(v_role, 'usuario')
  LIMIT 1;

  IF COALESCE(v_alcada.pode_aprovar, false) = false THEN
    RAISE EXCEPTION 'Perfil sem permissão para aprovar manutenção.';
  END IF;

  IF v_alcada.valor_maximo IS NOT NULL AND v_custo > v_alcada.valor_maximo THEN
    RAISE EXCEPTION 'Valor acima da sua alçada de aprovação.';
  END IF;

  UPDATE public.manutencoes
  SET
    aprovacao_status = CASE WHEN p_aprovado THEN 'aprovada' ELSE 'reprovada' END,
    aprovado_por = auth.uid(),
    aprovado_em = now(),
    aprovacao_observacoes = COALESCE(p_observacao, aprovacao_observacoes),
    status = CASE WHEN p_aprovado THEN 'programada' ELSE 'reprovada' END
  WHERE id = p_manutencao_id
    AND empresa_id = v_empresa_id;
END;
$$;

-- 3) Integração financeira automática
ALTER TABLE public.contas_financeiras
  ADD COLUMN IF NOT EXISTS manutencao_id uuid REFERENCES public.manutencoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_manutencao_id
  ON public.contas_financeiras(manutencao_id)
  WHERE manutencao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_manutencao_gerar_financeiro(
  p_manutencao_id uuid,
  p_data_vencimento date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_m public.manutencoes;
  v_conta_id uuid;
  v_descricao text;
BEGIN
  SELECT * INTO v_m
  FROM public.manutencoes
  WHERE id = p_manutencao_id
    AND empresa_id = public.minha_empresa_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manutenção não encontrada para financeiro.';
  END IF;

  IF COALESCE(v_m.custo_total, 0) <= 0 THEN
    RAISE EXCEPTION 'Manutenção sem custo para gerar lançamento financeiro.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contas_financeiras c
    WHERE c.manutencao_id = p_manutencao_id
      AND c.empresa_id = v_m.empresa_id
      AND c.tipo = 'pagar'
      AND c.status <> 'cancelado'
  ) THEN
    SELECT c.id INTO v_conta_id
    FROM public.contas_financeiras c
    WHERE c.manutencao_id = p_manutencao_id
      AND c.empresa_id = v_m.empresa_id
      AND c.tipo = 'pagar'
      AND c.status <> 'cancelado'
    ORDER BY c.created_at DESC
    LIMIT 1;
    RETURN v_conta_id;
  END IF;

  v_descricao :=
    'Manutenção ' ||
    COALESCE('MNT-' || LPAD(v_m.numero::text, 5, '0'), v_m.id::text) ||
    CASE WHEN v_m.descricao IS NOT NULL THEN ' - ' || LEFT(v_m.descricao, 80) ELSE '' END;

  INSERT INTO public.contas_financeiras (
    empresa_id,
    descricao,
    tipo,
    valor,
    data_vencimento,
    status,
    categoria,
    observacoes,
    manutencao_id
  ) VALUES (
    v_m.empresa_id,
    v_descricao,
    'pagar',
    v_m.custo_total,
    COALESCE(p_data_vencimento, now()::date),
    'pendente',
    'Manutenção',
    'Gerado automaticamente a partir da manutenção',
    p_manutencao_id
  ) RETURNING id INTO v_conta_id;

  RETURN v_conta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.manutencao_auto_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status IN ('concluida', 'concluida_observacao', 'concluida_parcial')
     AND COALESCE(NEW.custo_total, 0) > 0
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR COALESCE(NEW.custo_total, 0) IS DISTINCT FROM COALESCE(OLD.custo_total, 0))
  THEN
    PERFORM public.rpc_manutencao_gerar_financeiro(NEW.id, NEW.data_realizada);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencao_auto_financeiro ON public.manutencoes;
CREATE TRIGGER trg_manutencao_auto_financeiro
  AFTER INSERT OR UPDATE OF status, custo_total, data_realizada ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.manutencao_auto_financeiro();

-- 4) Preventivas automáticas
CREATE TABLE IF NOT EXISTS public.manutencao_planos_preventivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text,
  intervalo_km numeric,
  intervalo_dias int,
  ultimo_km_execucao numeric,
  ultima_execucao_em date,
  proxima_km numeric,
  proxima_data date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manutencao_planos_preventivos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_planos_preventivos' AND policyname = 'manutencao_planos_empresa'
  ) THEN
    CREATE POLICY "manutencao_planos_empresa"
      ON public.manutencao_planos_preventivos
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_planos_preventivos' AND policyname = 'manutencao_planos_insert'
  ) THEN
    CREATE POLICY "manutencao_planos_insert"
      ON public.manutencao_planos_preventivos
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_planos_preventivos' AND policyname = 'manutencao_planos_update'
  ) THEN
    CREATE POLICY "manutencao_planos_update"
      ON public.manutencao_planos_preventivos
      FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_manutencao_planos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencao_planos_empresa ON public.manutencao_planos_preventivos;
CREATE TRIGGER trg_manutencao_planos_empresa
  BEFORE INSERT OR UPDATE ON public.manutencao_planos_preventivos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_manutencao_planos();

CREATE OR REPLACE FUNCTION public.rpc_manutencao_gerar_preventivas()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_count int := 0;
  v_plano record;
  v_vencida boolean;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  IF v_empresa_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_plano IN
    SELECT p.*, v.km_atual
    FROM public.manutencao_planos_preventivos p
    JOIN public.veiculos v ON v.id = p.veiculo_id
    WHERE p.empresa_id = v_empresa_id
      AND p.ativo = true
  LOOP
    v_vencida := false;

    IF v_plano.proxima_data IS NOT NULL AND v_plano.proxima_data <= now()::date THEN
      v_vencida := true;
    END IF;

    IF v_plano.proxima_km IS NOT NULL AND COALESCE(v_plano.km_atual, 0) >= v_plano.proxima_km THEN
      v_vencida := true;
    END IF;

    IF v_vencida THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.manutencoes m
        WHERE m.empresa_id = v_empresa_id
          AND m.veiculo_id = v_plano.veiculo_id
          AND m.tipo = 'Preventiva'
          AND m.status NOT IN ('concluida', 'cancelada', 'reprovada', 'sem_solucao_tecnica')
          AND m.descricao ILIKE ('%' || v_plano.nome || '%')
      ) THEN
        INSERT INTO public.manutencoes (
          empresa_id,
          veiculo_id,
          tipo,
          descricao,
          categoria,
          urgencia,
          status,
          data_prevista,
          km_previsto,
          observacoes
        ) VALUES (
          v_empresa_id,
          v_plano.veiculo_id,
          'Preventiva',
          'Preventiva automática: ' || v_plano.nome,
          COALESCE(v_plano.categoria, 'preventiva'),
          'media',
          'pendente',
          COALESCE(v_plano.proxima_data, now()::date),
          COALESCE(v_plano.proxima_km, v_plano.km_atual),
          COALESCE(v_plano.observacoes, 'Gerada automaticamente por plano preventivo')
        );
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5) Indicadores essenciais
CREATE OR REPLACE FUNCTION public.rpc_manutencao_indicadores(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_inicio date := COALESCE(p_data_inicio, date_trunc('month', now())::date);
  v_fim date := COALESCE(p_data_fim, now()::date);
  v_total int := 0;
  v_concluidas int := 0;
  v_pendentes int := 0;
  v_urgentes int := 0;
  v_custo_total numeric := 0;
  v_tempo_parado_horas numeric := 0;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  SELECT COUNT(*) INTO v_total
  FROM public.manutencoes m
  WHERE m.empresa_id = v_empresa_id
    AND m.created_at::date BETWEEN v_inicio AND v_fim;

  SELECT COUNT(*) INTO v_concluidas
  FROM public.manutencoes m
  WHERE m.empresa_id = v_empresa_id
    AND m.status IN ('concluida', 'concluida_observacao', 'concluida_parcial')
    AND m.created_at::date BETWEEN v_inicio AND v_fim;

  SELECT COUNT(*) INTO v_pendentes
  FROM public.manutencoes m
  WHERE m.empresa_id = v_empresa_id
    AND m.status NOT IN ('concluida', 'concluida_observacao', 'concluida_parcial', 'cancelada', 'reprovada', 'sem_solucao_tecnica')
    AND m.created_at::date BETWEEN v_inicio AND v_fim;

  SELECT COUNT(*) INTO v_urgentes
  FROM public.manutencoes m
  WHERE m.empresa_id = v_empresa_id
    AND m.urgencia IN ('alta', 'critica')
    AND m.created_at::date BETWEEN v_inicio AND v_fim;

  SELECT COALESCE(SUM(m.custo_total), 0) INTO v_custo_total
  FROM public.manutencoes m
  WHERE m.empresa_id = v_empresa_id
    AND m.created_at::date BETWEEN v_inicio AND v_fim;

  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(m.fim_execucao_em, now()) - COALESCE(m.inicio_execucao_em, m.created_at))) / 3600), 0)
    INTO v_tempo_parado_horas
  FROM public.manutencoes m
  WHERE m.empresa_id = v_empresa_id
    AND m.status IN ('em_andamento', 'pausada', 'concluida', 'concluida_observacao', 'concluida_parcial')
    AND m.created_at::date BETWEEN v_inicio AND v_fim;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object('inicio', v_inicio, 'fim', v_fim),
    'total', v_total,
    'concluidas', v_concluidas,
    'pendentes', v_pendentes,
    'urgentes', v_urgentes,
    'custo_total', v_custo_total,
    'tempo_parado_horas', round(v_tempo_parado_horas::numeric, 2)
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_manutencao_req_compra_status ON public.manutencao_requisicoes_compra(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manutencao_planos_veiculo ON public.manutencao_planos_preventivos(empresa_id, veiculo_id, ativo);
CREATE INDEX IF NOT EXISTS idx_manutencao_planos_proxima_data ON public.manutencao_planos_preventivos(empresa_id, proxima_data);
