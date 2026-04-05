-- =============================================================================
-- MasterFleetBR - Módulo de MANUTENÇÃO PROFISSIONAL COMPLETO
-- Integração: Inventário + Financeiro + Agenda + App Motorista
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manutencao_prioridade') THEN
    CREATE TYPE public.manutencao_prioridade AS ENUM ('baixa', 'media', 'alta', 'critica');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manutencao_categoria') THEN
    CREATE TYPE public.manutencao_categoria AS ENUM ('motor', 'freios', 'suspensao', 'direcao', 'eletrica', 'pneus', 'carroceria', 'ar_condicionado', 'oleo_filtro', 'transmissao', 'escapamento', 'outros');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'solicitacao_manutencao_status') THEN
    CREATE TYPE public.solicitacao_manutencao_status AS ENUM ('nova', 'em_analise', 'aprovada', 'rejeitada', 'convertida', 'aguardando_info');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'solicitacao_manutencao_origem') THEN
    CREATE TYPE public.solicitacao_manutencao_origem AS ENUM ('motorista', 'admin', 'checklist', 'preventiva', 'checklist_pre_viagem');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordem_manutencao_tipo') THEN
    CREATE TYPE public.ordem_manutencao_tipo AS ENUM ('corretiva', 'preventiva', 'emergencial', 'preditiva');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordem_manutencao_status') THEN
    CREATE TYPE public.ordem_manutencao_status AS ENUM ('aberta', 'triagem', 'em_analise', 'aguardando_pecas', 'em_andamento', 'pausada', 'aguardando_terceiro', 'finalizada', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manutencao_peca_origem') THEN
    CREATE TYPE public.manutencao_peca_origem AS ENUM ('estoque', 'compra_direta');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preventiva_status') THEN
    CREATE TYPE public.preventiva_status AS ENUM ('em_dia', 'vencendo_proximo', 'vencida', 'concluida', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alerta_manutencao_tipo') THEN
    CREATE TYPE public.alerta_manutencao_tipo AS ENUM ('preventiva_vencida', 'preventiva_vencendo', 'custo_excedido', 'veiculo_parado', 'estoque_baixo', 'os_atrasada', 'garantia_vencendo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alerta_manutencao_severidade') THEN
    CREATE TYPE public.alerta_manutencao_severidade AS ENUM ('baixa', 'media', 'alta', 'critica');
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_manutencao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_manutencao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id()); RETURN NEW; END;
$$;

-- -----------------------------------------------------------------------------
-- 3. FORNECEDORES (expansão)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS razao_social text;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS tipos text[] DEFAULT '{}'::text[];
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_tipos ON public.fornecedores USING gin (tipos);

-- -----------------------------------------------------------------------------
-- 4. SOLICITAÇÕES DE MANUTENÇÃO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  categoria public.manutencao_categoria,
  titulo text NOT NULL,
  descricao text NOT NULL,
  prioridade public.manutencao_prioridade NOT NULL DEFAULT 'media',
  status public.solicitacao_manutencao_status NOT NULL DEFAULT 'nova',
  origem public.solicitacao_manutencao_origem NOT NULL DEFAULT 'admin',
  km_atual numeric,
  fotos text[] DEFAULT '{}',
  rejeicao_motivo text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sol_manut_empresa ON public.manutencao_solicitacoes(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sol_manut_veiculo ON public.manutencao_solicitacoes(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_sol_manut_motorista ON public.manutencao_solicitacoes(motorista_id);

-- -----------------------------------------------------------------------------
-- 5. ORDENS DE MANUTENÇÃO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_ordens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  solicitacao_id uuid REFERENCES public.manutencao_solicitacoes(id) ON DELETE SET NULL,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  tipo public.ordem_manutencao_tipo NOT NULL DEFAULT 'corretiva',
  status public.ordem_manutencao_status NOT NULL DEFAULT 'aberta',
  prioridade public.manutencao_prioridade NOT NULL DEFAULT 'media',
  categoria public.manutencao_categoria,
  
  -- Diagnóstico
  diagnostico text,
  causa_raiz text,
  solucao_aplicada text,
  laudo_tecnico text,
  
  -- Oficina
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  oficina_interna boolean NOT NULL DEFAULT true,
  responsavel_tecnico text,
  
  -- Operacional
  km_entrada numeric,
  km_saida numeric,
  data_entrada timestamptz DEFAULT now(),
  data_saida_prevista timestamptz,
  data_saida_real timestamptz,
  data_conclusao timestamptz,
  
  -- Financeiro
  custo_pecas numeric NOT NULL DEFAULT 0,
  custo_mao_de_obra numeric NOT NULL DEFAULT 0,
  custo_terceiros numeric NOT NULL DEFAULT 0,
  custo_total numeric NOT NULL DEFAULT 0,
  
  -- Mídia
  fotos_antes text[] DEFAULT '{}',
  fotos_depois text[] DEFAULT '{}',
  anexos jsonb DEFAULT '[]',
  
  -- Controle
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ordens_manut_empresa ON public.manutencao_ordens(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_manut_veiculo ON public.manutencao_ordens(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_ordens_manut_tipo ON public.manutencao_ordens(tipo);
CREATE INDEX IF NOT EXISTS idx_ordens_manut_fornecedor ON public.manutencao_ordens(fornecedor_id);

-- -----------------------------------------------------------------------------
-- 6. PEÇAS APLICADAS NAS OS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_ordens_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_id uuid NOT NULL REFERENCES public.manutencao_ordens(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  local_estoque_id uuid REFERENCES public.locais_estoque(id) ON DELETE SET NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  origem public.manutencao_peca_origem NOT NULL DEFAULT 'estoque',
  lote text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pecas_ordem ON public.manutencao_ordens_pecas(ordem_id);
CREATE INDEX IF NOT EXISTS idx_pecas_produto ON public.manutencao_ordens_pecas(produto_id);

-- -----------------------------------------------------------------------------
-- 7. SERVIÇOS/MÃO DE OBRA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_tipos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text,
  valor_hora numeric DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.manutencao_ordens_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_id uuid NOT NULL REFERENCES public.manutencao_ordens(id) ON DELETE CASCADE,
  tipo_servico_id uuid REFERENCES public.manutencao_tipos_servico(id) ON DELETE SET NULL,
  descricao text,
  quantidade_horas numeric DEFAULT 0,
  valor_hora numeric DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  mecanico_responsavel text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_servicos_ordem ON public.manutencao_ordens_servicos(ordem_id);

-- -----------------------------------------------------------------------------
-- 8. CHECKLIST ENTRADA/SAÍDA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_id uuid NOT NULL REFERENCES public.manutencao_ordens(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  itens jsonb NOT NULL DEFAULT '[]',
  observacoes_gerais text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_ordem ON public.manutencao_checklist(ordem_id);

-- -----------------------------------------------------------------------------
-- 9. PLANOS DE MANUTENÇÃO PREVENTIVA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  tipo_veiculo text,
  intervalo_km integer,
  intervalo_dias integer,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.manutencao_planos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.manutencao_planos(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  tipo_servico_id uuid REFERENCES public.manutencao_tipos_servico(id) ON DELETE SET NULL,
  quantidade numeric DEFAULT 1,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_itens_plano ON public.manutencao_planos_itens(plano_id);

-- -----------------------------------------------------------------------------
-- 10. PLANOS APLICADOS A VEÍCULOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_veiculo_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.manutencao_planos(id) ON DELETE CASCADE,
  ultima_execucao date,
  proxima_execucao_km numeric,
  proxima_execucao_data date,
  status public.preventiva_status NOT NULL DEFAULT 'em_dia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (veiculo_id, plano_id)
);

CREATE INDEX IF NOT EXISTS idx_veiculo_planos_status ON public.manutencao_veiculo_planos(empresa_id, status, proxima_execucao_data);

-- -----------------------------------------------------------------------------
-- 11. ALERTAS DE MANUTENÇÃO
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  ordem_id uuid REFERENCES public.manutencao_ordens(id) ON DELETE SET NULL,
  veiculo_plano_id uuid REFERENCES public.manutencao_veiculo_planos(id) ON DELETE SET NULL,
  tipo public.alerta_manutencao_tipo NOT NULL,
  severidade public.alerta_manutencao_severidade NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  mensagem text,
  lido boolean NOT NULL DEFAULT false,
  lido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_empresa ON public.manutencao_alertas(empresa_id, lido, created_at DESC);

-- -----------------------------------------------------------------------------
-- 12. TRIGGERS EMPRESA_ID E UPDATED_AT
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'manutencao_solicitacoes', 'manutencao_ordens', 'manutencao_ordens_pecas',
    'manutencao_ordens_servicos', 'manutencao_tipos_servico', 'manutencao_planos',
    'manutencao_planos_itens', 'manutencao_veiculo_planos', 'manutencao_alertas',
    'manutencao_checklist'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_empresa ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_empresa BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_manutencao()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_manutencao()', t, t);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 13. RLS POLICIES
-- -----------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'manutencao_solicitacoes', 'manutencao_ordens', 'manutencao_ordens_pecas',
    'manutencao_ordens_servicos', 'manutencao_tipos_servico', 'manutencao_planos',
    'manutencao_planos_itens', 'manutencao_veiculo_planos', 'manutencao_alertas',
    'manutencao_checklist'
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

-- Policy especial: motoristas podem criar solicitações
DROP POLICY IF EXISTS motoristas_create_solicitacoes ON public.manutencao_solicitacoes;
CREATE POLICY motoristas_create_solicitacoes ON public.manutencao_solicitacoes
  FOR INSERT WITH CHECK (
    empresa_id = public.minha_empresa_id()
    AND auth.uid() IN (SELECT user_id FROM public.profiles WHERE role = 'motorista')
  );

-- Motoristas podem ver suas próprias solicitações
DROP POLICY IF EXISTS motoristas_view_own_solicitacoes ON public.manutencao_solicitacoes;
CREATE POLICY motoristas_view_own_solicitacoes ON public.manutencao_solicitacoes
  FOR SELECT USING (
    motorista_id IN (SELECT id FROM public.motoristas WHERE auth.uid() = auth_user_id)
  );

-- -----------------------------------------------------------------------------
-- 14. RPC: CRIAR SOLICITAÇÃO
-- -----------------------------------------------------------------------------
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

  -- Tenta identificar motorista pelo auth.uid()
  SELECT id INTO v_motorista_id FROM public.motoristas WHERE auth_user_id = auth.uid() LIMIT 1;

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

  -- Gera alerta para admin
  INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, tipo, severidade, titulo, mensagem)
  VALUES (
    v_empresa_id, p_veiculo_id, 'nova_solicitacao',
    CASE WHEN p_prioridade = 'alta' OR p_prioridade = 'critica' THEN 'alta'::public.alerta_manutencao_severidade ELSE 'media'::public.alerta_manutencao_severidade END,
    'Nova solicitação de manutenção',
    p_titulo
  );

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 15. RPC: APROVAR SOLICITAÇÃO E CONVERTER EM OS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_aprovar_solicitacao(
  p_solicitacao_id uuid,
  p_tipo_os text DEFAULT 'corretiva',
  p_prioridade text DEFAULT 'media'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_sol public.manutencao_solicitacoes;
  v_ordem_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  SELECT * INTO v_sol FROM public.manutencao_solicitacoes WHERE id = p_solicitacao_id AND empresa_id = v_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_sol.status = 'convertida' THEN RAISE EXCEPTION 'Solicitação já convertida.'; END IF;

  INSERT INTO public.manutencao_ordens (
    empresa_id, solicitacao_id, veiculo_id, motorista_id, tipo, status, prioridade,
    categoria, diagnostico, km_entrada, data_entrada, created_by
  ) VALUES (
    v_empresa_id, v_sol.id, v_sol.veiculo_id, v_sol.motorista_id,
    p_tipo_os::public.ordem_manutencao_tipo,
    'aberta'::public.ordem_manutencao_status,
    p_prioridade::public.manutencao_prioridade,
    v_sol.categoria,
    v_sol.descricao,
    v_sol.km_atual,
    now(),
    auth.uid()
  ) RETURNING id INTO v_ordem_id;

  UPDATE public.manutencao_solicitacoes SET status = 'convertida', updated_by = auth.uid() WHERE id = v_sol.id;

  RETURN v_ordem_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 16. RPC: REJEITAR SOLICITAÇÃO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_rejeitar_solicitacao(
  p_solicitacao_id uuid,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_empresa_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  UPDATE public.manutencao_solicitacoes
  SET status = 'rejeitada', rejeicao_motivo = p_motivo, updated_by = auth.uid()
  WHERE id = p_solicitacao_id AND empresa_id = v_empresa_id AND status NOT IN ('convertida', 'rejeitada');
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada ou já processada.'; END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 17. RPC: ADICIONAR PEÇA NA OS (com baixa no estoque)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_adicionar_peca(
  p_ordem_id uuid,
  p_produto_id uuid,
  p_local_estoque_id uuid,
  p_quantidade numeric,
  p_valor_unitario numeric,
  p_origem text DEFAULT 'estoque',
  p_lote text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_ordem public.manutencao_ordens;
  v_id uuid;
  v_saldo numeric;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
  
  v_empresa_id := public.minha_empresa_id();
  SELECT * INTO v_ordem FROM public.manutencao_ordens WHERE id = p_ordem_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada.'; END IF;

  -- Verifica saldo se origem = estoque
  IF p_origem = 'estoque' THEN
    SELECT COALESCE(quantidade, 0) INTO v_saldo
    FROM public.saldos_estoque
    WHERE produto_id = p_produto_id AND deposito_id = COALESCE(p_local_estoque_id, (SELECT id FROM public.depositos WHERE empresa_id = v_empresa_id LIMIT 1));
    
    IF v_saldo < p_quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente. Disponível: %, Solicitado: %', v_saldo, p_quantidade;
    END IF;
  END IF;

  INSERT INTO public.manutencao_ordens_pecas (
    empresa_id, ordem_id, produto_id, local_estoque_id, quantidade, valor_unitario, origem, lote
  ) VALUES (
    v_empresa_id, p_ordem_id, p_produto_id, p_local_estoque_id, p_quantidade, p_valor_unitario, p_origem::public.manutencao_peca_origem, p_lote
  ) RETURNING id INTO v_id;

  -- Baixa no estoque
  IF p_origem = 'estoque' THEN
    DECLARE v_deposito_id uuid;
    BEGIN
      v_deposito_id := COALESCE(p_local_estoque_id, (SELECT id FROM public.depositos WHERE empresa_id = v_empresa_id LIMIT 1));
      INSERT INTO public.movimentos_estoque (empresa_id, produto_id, deposito_id, tipo, quantidade, origem, referencia_id, manutencao_id, veiculo_id)
      VALUES (v_empresa_id, p_produto_id, v_deposito_id, 'saida', p_quantidade, 'manutencao', p_ordem_id, p_ordem_id, v_ordem.veiculo_id);
    END;
  END IF;

  -- Recalcula custo
  UPDATE public.manutencao_ordens
  SET custo_pecas = COALESCE((SELECT SUM(valor_total) FROM public.manutencao_ordens_pecas WHERE ordem_id = p_ordem_id), 0),
      custo_total = COALESCE((SELECT SUM(valor_total) FROM public.manutencao_ordens_pecas WHERE ordem_id = p_ordem_id), 0) + COALESCE((SELECT SUM(valor_total) FROM public.manutencao_ordens_servicos WHERE ordem_id = p_ordem_id), 0)
  WHERE id = p_ordem_id;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 18. RPC: ADICIONAR SERVIÇO NA OS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_adicionar_servico(
  p_ordem_id uuid,
  p_tipo_servico_id uuid,
  p_descricao text,
  p_quantidade_horas numeric,
  p_valor_hora numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_id uuid;
  v_valor_total numeric;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  v_valor_total := COALESCE(p_quantidade_horas, 0) * COALESCE(p_valor_hora, 0);

  INSERT INTO public.manutencao_ordens_servicos (
    empresa_id, ordem_id, tipo_servico_id, descricao, quantidade_horas, valor_hora, valor_total
  ) VALUES (
    v_empresa_id, p_ordem_id, p_tipo_servico_id, p_descricao, p_quantidade_horas, p_valor_hora, v_valor_total
  ) RETURNING id INTO v_id;

  -- Recalcula custo
  UPDATE public.manutencao_ordens
  SET custo_mao_de_obra = COALESCE((SELECT SUM(valor_total) FROM public.manutencao_ordens_servicos WHERE ordem_id = p_ordem_id), 0),
      custo_total = COALESCE((SELECT SUM(valor_total) FROM public.manutencao_ordens_pecas WHERE ordem_id = p_ordem_id), 0) + COALESCE((SELECT SUM(valor_total) FROM public.manutencao_ordens_servicos WHERE ordem_id = p_ordem_id), 0)
  WHERE id = p_ordem_id;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 19. RPC: FINALIZAR ORDEM (gera conta a pagar)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_finalizar_ordem(
  p_ordem_id uuid,
  p_data_conclusao timestamptz DEFAULT now(),
  p_gerar_conta_pagar boolean DEFAULT true,
  p_solucao_aplicada text DEFAULT NULL,
  p_km_saida numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_ordem public.manutencao_ordens;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  SELECT * INTO v_ordem FROM public.manutencao_ordens WHERE id = p_ordem_id AND empresa_id = v_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ordem não encontrada.'; END IF;

  UPDATE public.manutencao_ordens
  SET status = 'finalizada',
      data_conclusao = COALESCE(p_data_conclusao, now()),
      data_saida_real = COALESCE(p_data_conclusao, now()),
      solucao_aplicada = COALESCE(p_solucao_aplicada, solucao_aplicada),
      km_saida = COALESCE(p_km_saida, km_saida),
      updated_by = auth.uid()
  WHERE id = p_ordem_id;

  -- Gera conta a pagar se houver custo
  IF p_gerar_conta_pagar AND COALESCE(v_ordem.custo_total, 0) > 0 THEN
    INSERT INTO public.contas_financeiras (
      empresa_id, descricao, tipo, valor, data_vencimento, status, categoria,
      manutencao_id, veiculo_id, observacoes
    ) VALUES (
      v_empresa_id,
      'OS Manutenção #' || SUBSTRING(p_ordem_id::text, 1, 8),
      'pagar',
      v_ordem.custo_total,
      CURRENT_DATE + INTERVAL '30 days',
      'pendente',
      'Manutenção',
      p_ordem_id,
      v_ordem.veiculo_id,
      'Gerado automaticamente ao finalizar OS de manutenção.'
    );
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 20. RPC: KPIs DE MANUTENÇÃO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_kpis(
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
    'total_os', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'os_abertas', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status = 'aberta'), 0),
    'os_em_andamento', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status = 'em_andamento'), 0),
    'os_aguardando_pecas', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status = 'aguardando_pecas'), 0),
    'os_finalizadas', COALESCE((SELECT COUNT(*) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'solicitacoes_novas', COALESCE((SELECT COUNT(*) FROM public.manutencao_solicitacoes WHERE empresa_id = v_empresa_id AND status = 'nova'), 0),
    'custo_total_periodo', COALESCE((SELECT SUM(custo_total) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'custo_medio_por_os', COALESCE((SELECT AVG(custo_total) FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim), 0),
    'preventivas_vencidas', COALESCE((SELECT COUNT(*) FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status = 'vencida'), 0),
    'alertas_nao_lidos', COALESCE((SELECT COUNT(*) FROM public.manutencao_alertas WHERE empresa_id = v_empresa_id AND lido = false), 0),
    'top_veiculos_custos', COALESCE((
      SELECT json_agg(json_build_object('veiculo_id', veiculo_id, 'placa', placa, 'modelo', modelo, 'total', total_custo))
      FROM (
        SELECT o.veiculo_id, v.placa, v.modelo, SUM(o.custo_total) as total_custo
        FROM public.manutencao_ordens o
        JOIN public.veiculos v ON v.id = o.veiculo_id
        WHERE o.empresa_id = v_empresa_id AND o.status = 'finalizada' AND o.created_at::date BETWEEN v_inicio AND v_fim
        GROUP BY o.veiculo_id, v.placa, v.modelo
        ORDER BY total_custo DESC
        LIMIT 5
      ) sub
    ), '[]'::json),
    'custo_por_categoria', COALESCE((
      SELECT json_agg(json_build_object('categoria', categoria, 'total', total_custo, 'count', total_count))
      FROM (
        SELECT categoria::text, SUM(custo_total) as total_custo, COUNT(*) as total_count
        FROM public.manutencao_ordens
        WHERE empresa_id = v_empresa_id AND status = 'finalizada' AND created_at::date BETWEEN v_inicio AND v_fim AND categoria IS NOT NULL
        GROUP BY categoria
        ORDER BY total_custo DESC
      ) sub
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 21. RPC: GERAR ALERTAS AUTOMÁTICOS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_gerar_alertas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_count integer := 0;
  r RECORD;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  -- Preventivas vencidas
  FOR r IN SELECT * FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status = 'vencida' LOOP
    INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, veiculo_plano_id, tipo, severidade, titulo, mensagem)
    VALUES (v_empresa_id, r.veiculo_id, r.id, 'preventiva_vencida', 'alta', 'Preventiva vencida', 'Veículo possui manutenção preventiva vencida.')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- Preventivas vencendo em 7 dias
  FOR r IN SELECT * FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status = 'vencendo_proximo' AND proxima_execucao_data <= CURRENT_DATE + 7 LOOP
    INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, veiculo_plano_id, tipo, severidade, titulo, mensagem)
    VALUES (v_empresa_id, r.veiculo_id, r.id, 'preventiva_vencendo', 'media', 'Preventiva vencendo', 'Manutenção preventiva vence em breve.')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  -- OS atrasadas (mais de 7 dias em andamento)
  FOR r IN SELECT * FROM public.manutencao_ordens WHERE empresa_id = v_empresa_id AND status = 'em_andamento' AND data_entrada < now() - INTERVAL '7 days' LOOP
    INSERT INTO public.manutencao_alertas (empresa_id, veiculo_id, ordem_id, tipo, severidade, titulo, mensagem)
    VALUES (v_empresa_id, r.veiculo_id, r.id, 'os_atrasada', 'alta', 'OS atrasada', 'Ordem de serviço em andamento há mais de 7 dias.')
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 22. RPC: PROCESSAR PREVENTIVAS (gera OS automáticas)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_processar_preventivas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_count integer := 0;
  r RECORD;
  v_ordem_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  FOR r IN SELECT * FROM public.manutencao_veiculo_planos WHERE empresa_id = v_empresa_id AND status IN ('vencida', 'vencendo_proximo') LOOP
    -- Verifica se já existe OS aberta para este veículo/plano
    IF NOT EXISTS (SELECT 1 FROM public.manutencao_ordens WHERE veiculo_id = r.veiculo_id AND status IN ('aberta', 'em_andamento') AND tipo = 'preventiva') THEN
      INSERT INTO public.manutencao_ordens (
        empresa_id, veiculo_id, tipo, status, prioridade,
        diagnostico, data_entrada, created_by
      ) VALUES (
        v_empresa_id, r.veiculo_id, 'preventiva', 'aberta', 'media',
        'Manutenção preventiva programada.', now(), auth.uid()
      ) RETURNING id INTO v_ordem_id;

      -- Adiciona itens do plano
      INSERT INTO public.manutencao_ordens_servicos (empresa_id, ordem_id, tipo_servico_id, quantidade_horas, valor_hora, valor_total)
      SELECT v_empresa_id, v_ordem_id, tipo_servico_id, 0, 0, 0
      FROM public.manutencao_planos_itens WHERE plano_id = r.plano_id AND tipo_servico_id IS NOT NULL;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Atualiza status dos planos
  UPDATE public.manutencao_veiculo_planos
  SET status = CASE
    WHEN proxima_execucao_data IS NOT NULL AND proxima_execucao_data < CURRENT_DATE THEN 'vencida'
    WHEN proxima_execucao_data IS NOT NULL AND proxima_execucao_data <= CURRENT_DATE + 7 THEN 'vencendo_proximo'
    ELSE 'em_dia'
  END
  WHERE empresa_id = v_empresa_id;

  RETURN v_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 23. RPC: ATUALIZAR STATUS SOLICITAÇÃO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_atualizar_status_solicitacao(
  p_solicitacao_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_empresa_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();
  UPDATE public.manutencao_solicitacoes
  SET status = p_status::public.solicitacao_manutencao_status, updated_by = auth.uid()
  WHERE id = p_solicitacao_id AND empresa_id = v_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 24. RPC: MARCAR ALERTA COMO LIDO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_marcar_alerta_lido(
  p_alerta_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.manutencao_alertas
  SET lido = true, lido_em = now()
  WHERE id = p_alerta_id AND empresa_id = public.minha_empresa_id();
END;
$$;

-- -----------------------------------------------------------------------------
-- 25. RPC: MARCAR TODOS ALERTAS COMO LIDOS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_marcar_todos_alertas_lidos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.manutencao_alertas
  SET lido = true, lido_em = now()
  WHERE empresa_id = public.minha_empresa_id() AND lido = false;
END;
$$;

-- -----------------------------------------------------------------------------
-- 26. ADICIONAR COLUNA manutencao_id EM contas_financeiras
-- -----------------------------------------------------------------------------
ALTER TABLE public.contas_financeiras ADD COLUMN IF NOT EXISTS manutencao_id uuid REFERENCES public.manutencao_ordens(id);
ALTER TABLE public.contas_financeiras ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id);

-- -----------------------------------------------------------------------------
-- 29. ADICIONAR COLUNA manutencao_id EM movimentos_estoque
-- -----------------------------------------------------------------------------
ALTER TABLE public.movimentos_estoque ADD COLUMN IF NOT EXISTS manutencao_id uuid REFERENCES public.manutencao_ordens(id);
ALTER TABLE public.movimentos_estoque ADD COLUMN IF NOT EXISTS veiculo_id uuid REFERENCES public.veiculos(id);

-- -----------------------------------------------------------------------------
-- 30. MIGRAÇÃO DE DADOS (tabelas antigas → novas)
-- -----------------------------------------------------------------------------
-- Migrar solicitações antigas (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'solicitacoes_manutencao') THEN
    INSERT INTO public.manutencao_solicitacoes (empresa_id, veiculo_id, motorista_id, descricao, prioridade, status, origem, km_atual, created_at)
    SELECT empresa_id, veiculo_id, motorista_id, descricao, prioridade, status, origem, km, created_at
    FROM public.solicitacoes_manutencao
    WHERE id NOT IN (SELECT id FROM public.manutencao_solicitacoes);
  END IF;
END
$$;

-- Migrar ordens antigas (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ordens_manutencao') THEN
    INSERT INTO public.manutencao_ordens (empresa_id, veiculo_id, solicitacao_id, tipo, status, prioridade, diagnostico, km_entrada, data_entrada, custo_total, created_at)
    SELECT empresa_id, veiculo_id, solicitacao_id, tipo, status, prioridade, diagnostico, km, data_abertura, custo_total, created_at
    FROM public.ordens_manutencao
    WHERE id NOT IN (SELECT id FROM public.manutencao_ordens);
  END IF;
END
$$;

-- Migrar peças antigas (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manutencao_pecas') THEN
    INSERT INTO public.manutencao_ordens_pecas (empresa_id, ordem_id, produto_id, local_estoque_id, quantidade, valor_unitario, origem, created_at)
    SELECT empresa_id, ordem_id, item_id, local_estoque_id, quantidade, valor_unitario, origem, created_at
    FROM public.manutencao_pecas
    WHERE id NOT IN (SELECT id FROM public.manutencao_ordens_pecas);
  END IF;
END
$$;

-- Migrar serviços antigos (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manutencao_servicos') THEN
    INSERT INTO public.manutencao_ordens_servicos (empresa_id, ordem_id, tipo_servico_id, descricao, valor_total, created_at)
    SELECT empresa_id, ordem_id, tipo_servico_id, descricao, valor, created_at
    FROM public.manutencao_servicos
    WHERE id NOT IN (SELECT id FROM public.manutencao_ordens_servicos);
  END IF;
END
$$;

-- Migrar planos antigos (se existirem) - com ON CONFLICT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planos_manutencao') THEN
    INSERT INTO public.manutencao_planos (empresa_id, nome, tipo_veiculo, ativo, created_at)
    SELECT empresa_id, nome, tipo_veiculo, ativo, created_at
    FROM public.planos_manutencao
    ON CONFLICT (empresa_id, nome) DO NOTHING;
  END IF;
END
$$;

-- Migrar preventivas antigas (se existirem) - com CAST de enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'preventiva_execucoes') THEN
    INSERT INTO public.manutencao_veiculo_planos (empresa_id, veiculo_id, plano_id, ultima_execucao, proxima_execucao_data, status, created_at)
    SELECT empresa_id, veiculo_id, plano_item_id, ultima_execucao, proxima_execucao, status::text::public.preventiva_status, created_at
    FROM public.preventiva_execucoes
    WHERE id NOT IN (SELECT id FROM public.manutencao_veiculo_planos);
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 31. REALTIME: Habilitar para tabelas principais (com verificação)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Verifica se as tabelas já estão na publicação
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'manutencao_solicitacoes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.manutencao_solicitacoes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'manutencao_ordens') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.manutencao_ordens;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'manutencao_alertas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.manutencao_alertas;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 32. STORAGE BUCKET para fotos de manutenção
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('manutencao-fotos', 'manutencao-fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "manutencao_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "manutencao_fotos_insert" ON storage.objects;
DROP POLICY IF EXISTS "manutencao_fotos_delete" ON storage.objects;

CREATE POLICY "manutencao_fotos_select" ON storage.objects FOR SELECT USING (bucket_id = 'manutencao-fotos');
CREATE POLICY "manutencao_fotos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'manutencao-fotos');
CREATE POLICY "manutencao_fotos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'manutencao-fotos');

-- -----------------------------------------------------------------------------
-- 33. VIEWS (criadas no final para garantir que tabelas existem)
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.manutencao_historico_veiculo CASCADE;
CREATE VIEW public.manutencao_historico_veiculo AS
SELECT
  v.id as veiculo_id,
  v.placa,
  v.modelo,
  v.marca,
  COUNT(o.id) as total_os,
  COUNT(o.id) FILTER (WHERE o.status::text = 'finalizada') as os_finalizadas,
  COUNT(o.id) FILTER (WHERE o.status::text IN ('aberta', 'em_andamento')) as os_em_aberto,
  COALESCE(SUM(o.custo_total) FILTER (WHERE o.status::text = 'finalizada'), 0) as custo_total,
  COALESCE(AVG(o.custo_total) FILTER (WHERE o.status::text = 'finalizada'), 0) as custo_medio,
  MAX(o.data_entrada) as ultima_manutencao,
  MAX(o.data_saida_real) as ultima_saida,
  COUNT(o.id) FILTER (WHERE o.tipo::text = 'preventiva') as total_preventivas,
  COUNT(o.id) FILTER (WHERE o.tipo::text = 'corretiva') as total_corretivas
FROM public.veiculos v
LEFT JOIN public.manutencao_ordens o ON o.veiculo_id = v.id
GROUP BY v.id, v.placa, v.modelo, v.marca;

DROP VIEW IF EXISTS public.manutencao_resumo_mensal CASCADE;
CREATE VIEW public.manutencao_resumo_mensal AS
SELECT
  DATE_TRUNC('month', created_at)::date as mes,
  COUNT(*) as total_os,
  COUNT(*) FILTER (WHERE status::text = 'finalizada') as finalizadas,
  COUNT(*) FILTER (WHERE tipo::text = 'preventiva') as preventivas,
  COUNT(*) FILTER (WHERE tipo::text = 'corretiva') as corretivas,
  COUNT(*) FILTER (WHERE tipo::text = 'emergencial') as emergenciais,
  COALESCE(SUM(custo_total) FILTER (WHERE status::text = 'finalizada'), 0) as custo_total,
  COALESCE(AVG(custo_total) FILTER (WHERE status::text = 'finalizada'), 0) as custo_medio,
  COUNT(DISTINCT veiculo_id) as veiculos_atendidos
FROM public.manutencao_ordens
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mes DESC;
