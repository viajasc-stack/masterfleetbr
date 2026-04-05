-- =============================================================================
-- MasterFleetBR - Módulo de OFICINA PROFISSIONAL
-- Sistema completo de gestão de oficina interna para empresas de turismo
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oficina_status_ot') THEN
    CREATE TYPE public.oficina_status_ot AS ENUM ('aberta', 'em_diagnostico', 'aguardando_aprovacao', 'aprovada', 'em_execucao', 'em_testes', 'finalizada', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oficina_tipo_servico') THEN
    CREATE TYPE public.oficina_tipo_servico AS ENUM ('mecanica', 'eletrica', 'funilaria', 'pintura', 'ar_condicionado', 'suspensao', 'freios', 'motor', 'transmissao', 'diagnostico', 'revisao', 'outros');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oficina_prioridade') THEN
    CREATE TYPE public.oficina_prioridade AS ENUM ('baixa', 'normal', 'alta', 'urgente');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oficina_status_orcamento') THEN
    CREATE TYPE public.oficina_status_orcamento AS ENUM ('pendente', 'aprovado', 'rejeitado', 'parcial');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oficina_status_garantia') THEN
    CREATE TYPE public.oficina_status_garantia AS ENUM ('ativa', 'expirada', 'usada', 'cancelada');
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. TABELAS PRINCIPAIS
-- -----------------------------------------------------------------------------

-- Ordens de Trabalho (OT) - coração do sistema de oficina
CREATE TABLE IF NOT EXISTS public.oficina_ordens_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero serial NOT NULL,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  
  -- Informações do serviço
  tipo_servico public.oficina_tipo_servico NOT NULL DEFAULT 'mecanica',
  prioridade public.oficina_prioridade NOT NULL DEFAULT 'normal',
  status public.oficina_status_ot NOT NULL DEFAULT 'aberta',
  
  -- Descrição do problema
  reclamacao_cliente text,
  diagnostico_tecnico text,
  servicos_executados text,
  observacoes_gerais text,
  
  -- Dados do veículo na entrada
  km_entrada numeric,
  nivel_combustivel_entrada numeric,
  data_entrada timestamptz DEFAULT now(),
  data_saida_prevista timestamptz,
  data_saida_real timestamptz,
  
  -- Responsáveis
  mecanico_responsavel_id uuid,
  supervisor_id uuid,
  
  -- Financeiro
  valor_mao_de_obra numeric DEFAULT 0,
  valor_pecas numeric DEFAULT 0,
  valor_descontos numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  
  -- Garantia
  garantia_dias integer DEFAULT 90,
  garantia_validade date,
  
  -- Controle
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_ot_empresa ON public.oficina_ordens_trabalho(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oficina_ot_veiculo ON public.oficina_ordens_trabalho(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_oficina_ot_cliente ON public.oficina_ordens_trabalho(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oficina_ot_mecanico ON public.oficina_ordens_trabalho(mecanico_responsavel_id);

-- Mecânicos/Funcionários da oficina
CREATE TABLE IF NOT EXISTS public.oficina_mecanicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  especialidade text,
  telefone text,
  email text,
  ativo boolean NOT NULL DEFAULT true,
  valor_hora numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_mecanicos_empresa ON public.oficina_mecanicos(empresa_id, ativo);

-- Serviços executados na OT
CREATE TABLE IF NOT EXISTS public.oficina_servicos_ot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ot_id uuid NOT NULL REFERENCES public.oficina_ordens_trabalho(id) ON DELETE CASCADE,
  mecanico_id uuid REFERENCES public.oficina_mecanicos(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  tipo_servico public.oficina_tipo_servico,
  tempo_gasto_horas numeric DEFAULT 0,
  valor_hora numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_servicos_ot ON public.oficina_servicos_ot(ot_id);

-- Peças utilizadas na OT
CREATE TABLE IF NOT EXISTS public.oficina_pecas_ot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ot_id uuid NOT NULL REFERENCES public.oficina_ordens_trabalho(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_peca text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric DEFAULT 0,
  origem text DEFAULT 'estoque',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_pecas_ot ON public.oficina_pecas_ot(ot_id);

-- Orçamentos da oficina
CREATE TABLE IF NOT EXISTS public.oficina_orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ot_id uuid REFERENCES public.oficina_ordens_trabalho(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero serial NOT NULL,
  status public.oficina_status_orcamento NOT NULL DEFAULT 'pendente',
  descricao text,
  validade date,
  valor_mao_de_obra numeric DEFAULT 0,
  valor_pecas numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  observacoes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_orcamentos_empresa ON public.oficina_orcamentos(empresa_id, status);

-- Itens do orçamento
CREATE TABLE IF NOT EXISTS public.oficina_orcamentos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  orcamento_id uuid NOT NULL REFERENCES public.oficina_orcamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_orcamentos_itens ON public.oficina_orcamentos_itens(orcamento_id);

-- Agenda da oficina
CREATE TABLE IF NOT EXISTS public.oficina_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ot_id uuid REFERENCES public.oficina_ordens_trabalho(id) ON DELETE SET NULL,
  mecanico_id uuid REFERENCES public.oficina_mecanicos(id) ON DELETE SET NULL,
  data date NOT NULL,
  hora_inicio time,
  hora_fim time,
  descricao text,
  status text NOT NULL DEFAULT 'agendado',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_agenda_empresa ON public.oficina_agenda(empresa_id, data);

-- Checklist de entrada/saída
CREATE TABLE IF NOT EXISTS public.oficina_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ot_id uuid NOT NULL REFERENCES public.oficina_ordens_trabalho(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  itens jsonb NOT NULL DEFAULT '[]',
  observacoes text,
  fotos text[] DEFAULT '{}',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_checklist_ot ON public.oficina_checklist(ot_id);

-- Histórico de garantia
CREATE TABLE IF NOT EXISTS public.oficina_garantias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ot_id uuid NOT NULL REFERENCES public.oficina_ordens_trabalho(id) ON DELETE CASCADE,
  descricao_problema text NOT NULL,
  solucao_aplicada text,
  status public.oficina_status_garantia NOT NULL DEFAULT 'ativa',
  data_abertura date NOT NULL DEFAULT CURRENT_DATE,
  data_conclusao date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oficina_garantias_ot ON public.oficina_garantias(ot_id, status);

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_oficina()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'oficina_ordens_trabalho', 'oficina_mecanicos', 'oficina_orcamentos'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_oficina()', t, t);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'oficina_ordens_trabalho', 'oficina_mecanicos', 'oficina_servicos_ot',
    'oficina_pecas_ot', 'oficina_orcamentos', 'oficina_orcamentos_itens',
    'oficina_agenda', 'oficina_checklist', 'oficina_garantias'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT USING (empresa_id = public.minha_empresa_id())', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id())', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id())', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (empresa_id = public.minha_empresa_id())', t, t);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 5. RPCs
-- -----------------------------------------------------------------------------

-- Criar nova OT
CREATE OR REPLACE FUNCTION public.oficina_criar_ot(
  p_veiculo_id uuid,
  p_cliente_id uuid DEFAULT NULL,
  p_mecanico_id uuid DEFAULT NULL,
  p_tipo_servico text DEFAULT 'mecanica',
  p_prioridade text DEFAULT 'normal',
  p_reclamacao text DEFAULT NULL,
  p_km_entrada numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Empresa não identificada.'; END IF;

  INSERT INTO public.oficina_ordens_trabalho (
    empresa_id, veiculo_id, cliente_id, mecanico_responsavel_id,
    tipo_servico, prioridade, reclamacao_cliente, km_entrada, data_entrada
  ) VALUES (
    v_empresa_id, p_veiculo_id, p_cliente_id, p_mecanico_id,
    p_tipo_servico::public.oficina_tipo_servico, p_prioridade::public.oficina_prioridade,
    p_reclamacao, p_km_entrada, now()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Atualizar status da OT
CREATE OR REPLACE FUNCTION public.oficina_atualizar_status_ot(
  p_ot_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_empresa_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  UPDATE public.oficina_ordens_trabalho
  SET status = p_status::public.oficina_status_ot, updated_by = auth.uid()
  WHERE id = p_ot_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OT não encontrada.'; END IF;
END;
$$;

-- Finalizar OT
CREATE OR REPLACE FUNCTION public.oficina_finalizar_ot(
  p_ot_id uuid,
  p_servicos_executados text DEFAULT NULL,
  p_gerar_fatura boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_ot public.oficina_ordens_trabalho;
  v_total_pecas numeric;
  v_total_servicos numeric;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  SELECT * INTO v_ot FROM public.oficina_ordens_trabalho WHERE id = p_ot_id AND empresa_id = v_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OT não encontrada.'; END IF;

  -- Calcular totais
  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pecas FROM public.oficina_pecas_ot WHERE ot_id = p_ot_id;
  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos FROM public.oficina_servicos_ot WHERE ot_id = p_ot_id;

  UPDATE public.oficina_ordens_trabalho
  SET status = 'finalizada',
      data_saida_real = now(),
      servicos_executados = COALESCE(p_servicos_executados, servicos_executados),
      valor_pecas = v_total_pecas,
      valor_mao_de_obra = v_total_servicos,
      valor_total = v_total_pecas + v_total_servicos - COALESCE(valor_descontos, 0),
      garantia_validade = CURRENT_DATE + (COALESCE(garantia_dias, 90) || ' days')::interval
  WHERE id = p_ot_id;

  -- Gerar conta a pagar se for veículo próprio
  IF p_gerar_fatura AND v_ot.veiculo_id IS NOT NULL AND v_ot.cliente_id IS NULL THEN
    INSERT INTO public.contas_financeiras (
      empresa_id, descricao, tipo, valor, data_vencimento, status, categoria,
      oficina_ot_id, veiculo_id, observacoes
    ) VALUES (
      v_empresa_id,
      'OT #' || (SELECT numero FROM public.oficina_ordens_trabalho WHERE id = p_ot_id),
      'pagar',
      v_total_pecas + v_total_servicos,
      CURRENT_DATE + INTERVAL '30 days',
      'pendente',
      'Oficina',
      p_ot_id,
      v_ot.veiculo_id,
      'Gerado automaticamente ao finalizar OT'
    );
  END IF;
END;
$$;

-- Adicionar peça na OT
CREATE OR REPLACE FUNCTION public.oficina_adicionar_peca(
  p_ot_id uuid,
  p_produto_id uuid,
  p_quantidade numeric,
  p_valor_unitario numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  
  INSERT INTO public.oficina_pecas_ot (
    empresa_id, ot_id, produto_id, nome_peca, quantidade, valor_unitario, valor_total
  )
  SELECT v_empresa_id, p_ot_id, p.id, p.nome, p_quantidade, p_valor_unitario, p_quantidade * p_valor_unitario
  FROM public.produtos p WHERE p.id = p_produto_id
  RETURNING id INTO v_id;

  -- Baixa no estoque
  INSERT INTO public.movimentos_estoque (empresa_id, produto_id, deposito_id, tipo, quantidade, origem, referencia_id)
  SELECT v_empresa_id, p_produto_id, (SELECT id FROM public.depositos WHERE empresa_id = v_empresa_id LIMIT 1), 'saida', p_quantidade, 'oficina', p_ot_id;

  RETURN v_id;
END;
$$;

-- Adicionar serviço na OT
CREATE OR REPLACE FUNCTION public.oficina_adicionar_servico(
  p_ot_id uuid,
  p_mecanico_id uuid,
  p_descricao text,
  p_tempo_horas numeric,
  p_valor_hora numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  
  INSERT INTO public.oficina_servicos_ot (
    empresa_id, ot_id, mecanico_id, descricao, tempo_gasto_horas, valor_hora, valor_total
  ) VALUES (
    v_empresa_id, p_ot_id, p_mecanico_id, p_descricao, p_tempo_horas, p_valor_hora, p_tempo_horas * p_valor_hora
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- KPIs da oficina
CREATE OR REPLACE FUNCTION public.oficina_kpis(
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_inicio date;
  v_fim date;
  v_result json;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  v_inicio := COALESCE(p_data_inicio, (CURRENT_DATE - INTERVAL '30 days')::date);
  v_fim := COALESCE(p_data_fim, CURRENT_DATE);

  SELECT json_build_object(
    'total_ot', COALESCE((SELECT COUNT(*) FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND data_entrada::date BETWEEN v_inicio AND v_fim), 0),
    'ot_abertas', COALESCE((SELECT COUNT(*) FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND status IN ('aberta', 'em_diagnostico', 'em_execucao')), 0),
    'ot_finalizadas', COALESCE((SELECT COUNT(*) FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND data_saida_real::date BETWEEN v_inicio AND v_fim), 0),
    'faturamento_total', COALESCE((SELECT SUM(valor_total) FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND data_saida_real::date BETWEEN v_inicio AND v_fim), 0),
    'ticket_medio', COALESCE((SELECT AVG(valor_total) FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND data_saida_real::date BETWEEN v_inicio AND v_fim), 0),
    'tempo_medio_horas', COALESCE((SELECT AVG(EXTRACT(EPOCH FROM (data_saida_real - data_entrada))/3600) FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND data_saida_real IS NOT NULL), 0),
    'por_tipo_servico', COALESCE((
      SELECT json_agg(json_build_object('tipo', tipo_servico, 'count', cnt))
      FROM (SELECT tipo_servico, COUNT(*) as cnt FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND data_entrada::date BETWEEN v_inicio AND v_fim GROUP BY tipo_servico) sub
    ), '[]'::json),
    'top_mecanicos', COALESCE((
      SELECT json_agg(json_build_object('mecanico', m.nome, 'ots', cnt))
      FROM (SELECT mecanico_responsavel_id, COUNT(*) as cnt FROM public.oficina_ordens_trabalho WHERE empresa_id = v_empresa_id AND data_entrada::date BETWEEN v_inicio AND v_fim GROUP BY mecanico_responsavel_id ORDER BY cnt DESC LIMIT 5) sub
      JOIN public.oficina_mecanicos m ON m.id = sub.mecanico_responsavel_id
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. COLUNA EM contas_financeiras
-- -----------------------------------------------------------------------------
ALTER TABLE public.contas_financeiras ADD COLUMN IF NOT EXISTS oficina_ot_id uuid REFERENCES public.oficina_ordens_trabalho(id);

-- -----------------------------------------------------------------------------
-- 7. REALTIME
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'oficina_ordens_trabalho') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.oficina_ordens_trabalho;
  END IF;
END
$$;