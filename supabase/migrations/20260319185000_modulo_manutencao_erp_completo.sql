-- =============================================================================
-- MasterFleetBR - Módulo de MANUTENÇÃO (ERP) completo
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manutencao_prioridade') THEN
    CREATE TYPE public.manutencao_prioridade AS ENUM ('baixa', 'media', 'alta');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'solicitacao_manutencao_status') THEN
    CREATE TYPE public.solicitacao_manutencao_status AS ENUM ('nova', 'em_analise', 'aprovada', 'rejeitada', 'convertida');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'solicitacao_manutencao_origem') THEN
    CREATE TYPE public.solicitacao_manutencao_origem AS ENUM ('motorista', 'admin', 'checklist', 'preventiva');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordem_manutencao_tipo') THEN
    CREATE TYPE public.ordem_manutencao_tipo AS ENUM ('corretiva', 'preventiva', 'emergencial');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ordem_manutencao_status') THEN
    CREATE TYPE public.ordem_manutencao_status AS ENUM ('aberta', 'analise', 'aguardando_pecas', 'andamento', 'finalizada');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manutencao_peca_origem') THEN
    CREATE TYPE public.manutencao_peca_origem AS ENUM ('estoque', 'compra');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preventiva_execucao_status') THEN
    CREATE TYPE public.preventiva_execucao_status AS ENUM ('em_dia', 'vencendo', 'vencida', 'concluida');
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_manutencao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_manutencao_generic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Fornecedores (expansão da tabela já existente)
-- -----------------------------------------------------------------------------
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS tipos text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_nome ON public.fornecedores(empresa_id, nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_tipos ON public.fornecedores USING gin (tipos);

DROP TRIGGER IF EXISTS trg_fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_manutencao();

-- -----------------------------------------------------------------------------
-- Solicitações
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitacoes_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  prioridade public.manutencao_prioridade NOT NULL DEFAULT 'media',
  status public.solicitacao_manutencao_status NOT NULL DEFAULT 'nova',
  km numeric,
  origem public.solicitacao_manutencao_origem NOT NULL DEFAULT 'admin',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Ordens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ordens_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  solicitacao_id uuid REFERENCES public.solicitacoes_manutencao(id) ON DELETE SET NULL,
  tipo public.ordem_manutencao_tipo NOT NULL DEFAULT 'corretiva',
  status public.ordem_manutencao_status NOT NULL DEFAULT 'aberta',
  prioridade public.manutencao_prioridade NOT NULL DEFAULT 'media',
  diagnostico text,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  km numeric,
  custo_total numeric NOT NULL DEFAULT 0,
  data_abertura timestamptz NOT NULL DEFAULT now(),
  data_conclusao timestamptz,
  anexos jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Peças e serviços
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manutencao_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_id uuid NOT NULL REFERENCES public.ordens_manutencao(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  local_estoque_id uuid REFERENCES public.locais_estoque(id) ON DELETE SET NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL DEFAULT 0,
  origem public.manutencao_peca_origem NOT NULL DEFAULT 'estoque',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tipos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.manutencao_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_id uuid NOT NULL REFERENCES public.ordens_manutencao(id) ON DELETE CASCADE,
  tipo_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Planos e preventiva
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planos_manutencao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo_veiculo text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.plano_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos_manutencao(id) ON DELETE CASCADE,
  tipo_servico_id uuid REFERENCES public.tipos_servico(id) ON DELETE SET NULL,
  intervalo_km int,
  intervalo_dias int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.preventiva_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  plano_item_id uuid NOT NULL REFERENCES public.plano_itens(id) ON DELETE CASCADE,
  ultima_execucao date,
  proxima_execucao date,
  status public.preventiva_execucao_status NOT NULL DEFAULT 'em_dia',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (veiculo_id, plano_item_id)
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sol_manut_empresa_status ON public.solicitacoes_manutencao(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_manut_empresa_status ON public.ordens_manutencao(empresa_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_manut_empresa_veiculo ON public.ordens_manutencao(empresa_id, veiculo_id);
CREATE INDEX IF NOT EXISTS idx_pecas_ordem ON public.manutencao_pecas(ordem_id);
CREATE INDEX IF NOT EXISTS idx_servicos_ordem ON public.manutencao_servicos(ordem_id);
CREATE INDEX IF NOT EXISTS idx_plano_itens_plano ON public.plano_itens(plano_id);
CREATE INDEX IF NOT EXISTS idx_preventiva_empresa_status ON public.preventiva_execucoes(empresa_id, status, proxima_execucao);

-- -----------------------------------------------------------------------------
-- Triggers empresa/timestamp
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'solicitacoes_manutencao',
    'ordens_manutencao',
    'manutencao_pecas',
    'manutencao_servicos',
    'tipos_servico',
    'planos_manutencao',
    'plano_itens',
    'preventiva_execucoes'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_empresa ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_empresa BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_manutencao_generic()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_manutencao()', t, t);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- RLS multiempresa
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'solicitacoes_manutencao',
    'ordens_manutencao',
    'manutencao_pecas',
    'manutencao_servicos',
    'tipos_servico',
    'planos_manutencao',
    'plano_itens',
    'preventiva_execucoes'
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
-- Regras de negócio e integrações
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manutencao_recalcular_custo_ordem(p_ordem_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_total_pecas numeric;
  v_total_servicos numeric;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  SELECT COALESCE(SUM(quantidade * valor_unitario), 0)
    INTO v_total_pecas
  FROM public.manutencao_pecas
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;

  SELECT COALESCE(SUM(valor), 0)
    INTO v_total_servicos
  FROM public.manutencao_servicos
  WHERE ordem_id = p_ordem_id
    AND empresa_id = v_empresa_id;

  UPDATE public.ordens_manutencao
     SET custo_total = COALESCE(v_total_pecas, 0) + COALESCE(v_total_servicos, 0),
         updated_at = now()
   WHERE id = p_ordem_id
     AND empresa_id = v_empresa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.manutencao_sync_custo_ordem_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ordem_id uuid;
BEGIN
  v_ordem_id := COALESCE(NEW.ordem_id, OLD.ordem_id);
  PERFORM public.manutencao_recalcular_custo_ordem(v_ordem_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencao_pecas_custo_ins ON public.manutencao_pecas;
DROP TRIGGER IF EXISTS trg_manutencao_pecas_custo_upd ON public.manutencao_pecas;
DROP TRIGGER IF EXISTS trg_manutencao_pecas_custo_del ON public.manutencao_pecas;
CREATE TRIGGER trg_manutencao_pecas_custo_ins AFTER INSERT ON public.manutencao_pecas FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_custo_ordem_trigger();
CREATE TRIGGER trg_manutencao_pecas_custo_upd AFTER UPDATE ON public.manutencao_pecas FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_custo_ordem_trigger();
CREATE TRIGGER trg_manutencao_pecas_custo_del AFTER DELETE ON public.manutencao_pecas FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_custo_ordem_trigger();

DROP TRIGGER IF EXISTS trg_manutencao_servicos_custo_ins ON public.manutencao_servicos;
DROP TRIGGER IF EXISTS trg_manutencao_servicos_custo_upd ON public.manutencao_servicos;
DROP TRIGGER IF EXISTS trg_manutencao_servicos_custo_del ON public.manutencao_servicos;
CREATE TRIGGER trg_manutencao_servicos_custo_ins AFTER INSERT ON public.manutencao_servicos FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_custo_ordem_trigger();
CREATE TRIGGER trg_manutencao_servicos_custo_upd AFTER UPDATE ON public.manutencao_servicos FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_custo_ordem_trigger();
CREATE TRIGGER trg_manutencao_servicos_custo_del AFTER DELETE ON public.manutencao_servicos FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_custo_ordem_trigger();

CREATE OR REPLACE FUNCTION public.manutencao_converter_solicitacao_em_os(p_solicitacao_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_sol public.solicitacoes_manutencao;
  v_ordem_id uuid;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  SELECT * INTO v_sol
  FROM public.solicitacoes_manutencao
  WHERE id = p_solicitacao_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;

  IF v_sol.status = 'convertida' THEN
    RAISE EXCEPTION 'Solicitação já convertida em OS.';
  END IF;

  INSERT INTO public.ordens_manutencao (
    empresa_id,
    veiculo_id,
    solicitacao_id,
    tipo,
    status,
    prioridade,
    diagnostico,
    km,
    data_abertura,
    created_by,
    updated_by
  ) VALUES (
    v_empresa_id,
    v_sol.veiculo_id,
    v_sol.id,
    CASE WHEN v_sol.origem = 'preventiva' THEN 'preventiva'::public.ordem_manutencao_tipo ELSE 'corretiva'::public.ordem_manutencao_tipo END,
    'aberta'::public.ordem_manutencao_status,
    v_sol.prioridade,
    v_sol.descricao,
    v_sol.km,
    now(),
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_ordem_id;

  UPDATE public.solicitacoes_manutencao
     SET status = 'convertida',
         updated_at = now(),
         updated_by = auth.uid()
   WHERE id = v_sol.id;

  RETURN v_ordem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.manutencao_adicionar_peca(
  p_ordem_id uuid,
  p_item_id uuid,
  p_local_estoque_id uuid,
  p_quantidade numeric,
  p_valor_unitario numeric,
  p_origem public.manutencao_peca_origem DEFAULT 'estoque'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_ordem public.ordens_manutencao;
  v_id uuid;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida.';
  END IF;

  v_empresa_id := public.minha_empresa_id();
  SELECT * INTO v_ordem
  FROM public.ordens_manutencao
  WHERE id = p_ordem_id
    AND empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem não encontrada.';
  END IF;

  INSERT INTO public.manutencao_pecas (
    empresa_id,
    ordem_id,
    item_id,
    local_estoque_id,
    quantidade,
    valor_unitario,
    origem
  ) VALUES (
    v_empresa_id,
    p_ordem_id,
    p_item_id,
    p_local_estoque_id,
    p_quantidade,
    COALESCE(p_valor_unitario, 0),
    COALESCE(p_origem, 'estoque')
  ) RETURNING id INTO v_id;

  IF COALESCE(p_origem, 'estoque') = 'estoque' THEN
    IF p_local_estoque_id IS NULL THEN
      RAISE EXCEPTION 'Local de estoque obrigatório para peça de estoque.';
    END IF;

    PERFORM public.estoque_aplicar_movimento(
      p_item_id,
      p_local_estoque_id,
      'saida',
      p_quantidade,
      'manutencao',
      'Baixa automática por OS de manutenção',
      'ordens_manutencao',
      p_ordem_id,
      NULL,
      v_ordem.veiculo_id,
      NULL,
      auth.uid(),
      NULL
    );
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.manutencao_finalizar_ordem(
  p_ordem_id uuid,
  p_data_conclusao timestamptz DEFAULT now(),
  p_gerar_conta_pagar boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_ordem public.ordens_manutencao;
BEGIN
  v_empresa_id := public.minha_empresa_id();

  SELECT * INTO v_ordem
  FROM public.ordens_manutencao
  WHERE id = p_ordem_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem não encontrada.';
  END IF;

  UPDATE public.ordens_manutencao
     SET status = 'finalizada',
         data_conclusao = COALESCE(p_data_conclusao, now()),
         updated_at = now(),
         updated_by = auth.uid()
   WHERE id = p_ordem_id
     AND empresa_id = v_empresa_id;

  IF p_gerar_conta_pagar
     AND COALESCE(v_ordem.custo_total, 0) > 0
     AND v_ordem.fornecedor_id IS NOT NULL THEN
    INSERT INTO public.contas_financeiras (
      empresa_id,
      descricao,
      tipo,
      valor,
      data_vencimento,
      status,
      categoria,
      observacoes
    ) VALUES (
      v_empresa_id,
      'OS Manutenção ' || p_ordem_id::text,
      'pagar',
      v_ordem.custo_total,
      CURRENT_DATE,
      'pendente',
      'Manutenção',
      'Gerado automaticamente ao finalizar ordem de manutenção.'
    );
  END IF;
END;
$$;
