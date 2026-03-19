-- =============================================================================
-- MasterFleetBR - Rebuild do módulo ESTOQUE (ERP)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estoque_movimento_tipo') THEN
    CREATE TYPE public.estoque_movimento_tipo AS ENUM (
      'entrada',
      'saida',
      'ajuste_positivo',
      'ajuste_negativo',
      'transferencia_saida',
      'transferencia_entrada',
      'devolucao',
      'inventario_fisico'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estoque_entrada_tipo') THEN
    CREATE TYPE public.estoque_entrada_tipo AS ENUM (
      'compra',
      'devolucao',
      'transferencia_recebida',
      'ajuste_positivo',
      'retorno_nao_utilizado',
      'manual'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estoque_saida_tipo') THEN
    CREATE TYPE public.estoque_saida_tipo AS ENUM (
      'manutencao',
      'consumo_interno',
      'abastecimento',
      'perda',
      'avaria',
      'vencimento',
      'devolucao_fornecedor',
      'transferencia_enviada',
      'ajuste_negativo',
      'manual'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estoque_pedido_status') THEN
    CREATE TYPE public.estoque_pedido_status AS ENUM (
      'rascunho',
      'aguardando_aprovacao',
      'aprovado',
      'pedido_enviado',
      'recebido_parcial',
      'recebido_total',
      'cancelado'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventario_fisico_status') THEN
    CREATE TYPE public.inventario_fisico_status AS ENUM ('aberto', 'em_contagem', 'concluido', 'ajustado');
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Helpers genéricos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_estoque_generic()
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
-- Expansão de FORNECEDORES existente
-- -----------------------------------------------------------------------------
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS site text,
  ADD COLUMN IF NOT EXISTS contato_principal text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS prazo_medio_entrega int,
  ADD COLUMN IF NOT EXISTS forma_pagamento_padrao text,
  ADD COLUMN IF NOT EXISTS limite_credito numeric,
  ADD COLUMN IF NOT EXISTS desconto_padrao numeric,
  ADD COLUMN IF NOT EXISTS categoria_fornecimento text,
  ADD COLUMN IF NOT EXISTS avaliacao_interna numeric,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_ativo_nome ON public.fornecedores(empresa_id, ativo, nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_cnpj ON public.fornecedores(empresa_id, cnpj) WHERE cnpj IS NOT NULL;

DROP TRIGGER IF EXISTS trg_fornecedores_updated_at ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_estoque();

-- -----------------------------------------------------------------------------
-- Tabelas base do novo ESTOQUE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  cor_icone text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.locais_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

CREATE TABLE IF NOT EXISTS public.itens_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo_interno text,
  sku text,
  codigo_barras text,
  categoria_id uuid REFERENCES public.categorias_estoque(id) ON DELETE SET NULL,
  subcategoria text,
  unidade_medida text NOT NULL DEFAULT 'un',
  marca text,
  modelo text,
  aplicacao text,
  fornecedor_principal_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  estoque_minimo numeric NOT NULL DEFAULT 0,
  estoque_ideal numeric,
  estoque_maximo numeric,
  custo_compra numeric,
  custo_medio numeric,
  controla_lote boolean NOT NULL DEFAULT false,
  controla_validade boolean NOT NULL DEFAULT false,
  imagem_item_url text,
  ficha_tecnica_url text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo_interno)
);

CREATE TABLE IF NOT EXISTS public.estoques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE CASCADE,
  local_estoque_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  custo_medio numeric,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, local_estoque_id)
);

CREATE TABLE IF NOT EXISTS public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  local_estoque_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE RESTRICT,
  tipo public.estoque_movimento_tipo NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  saldo_anterior numeric NOT NULL,
  saldo_posterior numeric NOT NULL,
  motivo text,
  observacao text,
  custo_unitario numeric,
  origem_tabela text,
  origem_id uuid,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  responsavel_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Ajuste de ENTRADAS existente para operação ERP
-- -----------------------------------------------------------------------------
ALTER TABLE public.entradas_estoque
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.itens_estoque(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS local_estoque_id uuid REFERENCES public.locais_estoque(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_entrada public.estoque_entrada_tipo,
  ADD COLUMN IF NOT EXISTS unidade text,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS lote text,
  ADD COLUMN IF NOT EXISTS validade date,
  ADD COLUMN IF NOT EXISTS pedido_compra_id uuid,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.entradas_estoque
SET tipo_entrada = COALESCE(tipo_entrada, 'manual'::public.estoque_entrada_tipo)
WHERE tipo_entrada IS NULL;

CREATE INDEX IF NOT EXISTS idx_entradas_estoque_item_local_data ON public.entradas_estoque(empresa_id, item_id, local_estoque_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_entradas_estoque_updated_at ON public.entradas_estoque;
CREATE TRIGGER trg_entradas_estoque_updated_at
  BEFORE UPDATE ON public.entradas_estoque
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_estoque();

-- -----------------------------------------------------------------------------
-- Saídas / Compras / Transferências / Ajustes / Inventário físico
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saidas_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data timestamptz NOT NULL DEFAULT now(),
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  tipo_saida public.estoque_saida_tipo NOT NULL,
  motivo text,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  responsavel_id uuid,
  local_estoque_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE RESTRICT,
  observacoes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedidos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  data timestamptz NOT NULL DEFAULT now(),
  status public.estoque_pedido_status NOT NULL DEFAULT 'rascunho',
  observacoes text,
  prazo_entrega date,
  forma_pagamento text,
  desconto numeric DEFAULT 0,
  frete numeric DEFAULT 0,
  valor_total numeric DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedidos_compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_compra_id uuid NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  recebido_quantidade numeric NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transferencias_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data timestamptz NOT NULL DEFAULT now(),
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  local_origem_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE RESTRICT,
  local_destino_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  responsavel_id uuid,
  observacao text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ajustes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data timestamptz NOT NULL DEFAULT now(),
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  local_estoque_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE RESTRICT,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  tipo_ajuste text NOT NULL CHECK (tipo_ajuste IN ('positivo','negativo')),
  motivo text NOT NULL,
  observacao text,
  responsavel_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventarios_fisicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  data timestamptz NOT NULL DEFAULT now(),
  local_estoque_id uuid NOT NULL REFERENCES public.locais_estoque(id) ON DELETE RESTRICT,
  status public.inventario_fisico_status NOT NULL DEFAULT 'aberto',
  observacoes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventarios_fisicos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  inventario_fisico_id uuid NOT NULL REFERENCES public.inventarios_fisicos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens_estoque(id) ON DELETE RESTRICT,
  saldo_sistema numeric NOT NULL DEFAULT 0,
  saldo_fisico numeric NOT NULL DEFAULT 0,
  diferenca numeric NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventario_fisico_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.configuracoes_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  permitir_estoque_negativo boolean NOT NULL DEFAULT false,
  exigir_motivo_ajuste boolean NOT NULL DEFAULT true,
  exigir_aprovacao_compras boolean NOT NULL DEFAULT false,
  habilitar_controle_lote boolean NOT NULL DEFAULT false,
  habilitar_controle_validade boolean NOT NULL DEFAULT false,
  habilitar_multiplos_locais boolean NOT NULL DEFAULT true,
  habilitar_reserva_estoque boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK atrasada (depende de pedidos_compra)
ALTER TABLE public.entradas_estoque
  DROP CONSTRAINT IF EXISTS entradas_estoque_pedido_compra_id_fkey;

ALTER TABLE public.entradas_estoque
  ADD CONSTRAINT entradas_estoque_pedido_compra_id_fkey
  FOREIGN KEY (pedido_compra_id) REFERENCES public.pedidos_compra(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_categorias_estoque_empresa_ativo ON public.categorias_estoque(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_locais_estoque_empresa_ativo ON public.locais_estoque(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_itens_estoque_empresa_ativo ON public.itens_estoque(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_itens_estoque_categoria ON public.itens_estoque(empresa_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_itens_estoque_fornecedor ON public.itens_estoque(empresa_id, fornecedor_principal_id);
CREATE INDEX IF NOT EXISTS idx_estoques_empresa_item_local ON public.estoques(empresa_id, item_id, local_estoque_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_empresa_data ON public.movimentacoes_estoque(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_empresa_item ON public.movimentacoes_estoque(empresa_id, item_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_empresa_tipo ON public.movimentacoes_estoque(empresa_id, tipo);
CREATE INDEX IF NOT EXISTS idx_saidas_empresa_data ON public.saidas_estoque(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_empresa_status ON public.pedidos_compra(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_transferencias_empresa_data ON public.transferencias_estoque(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_ajustes_empresa_data ON public.ajustes_estoque(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_inventarios_fisicos_empresa_status ON public.inventarios_fisicos(empresa_id, status);

-- -----------------------------------------------------------------------------
-- Trigger de empresa/timestamp
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categorias_estoque',
    'locais_estoque',
    'itens_estoque',
    'estoques',
    'movimentacoes_estoque',
    'saidas_estoque',
    'pedidos_compra',
    'pedidos_compra_itens',
    'transferencias_estoque',
    'ajustes_estoque',
    'inventarios_fisicos',
    'inventarios_fisicos_itens',
    'configuracoes_inventario'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_empresa ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_empresa BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_estoque_generic()', t, t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_estoque()', t, t);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- RLS / Policies multiempresa
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categorias_estoque',
    'locais_estoque',
    'itens_estoque',
    'estoques',
    'movimentacoes_estoque',
    'saidas_estoque',
    'pedidos_compra',
    'pedidos_compra_itens',
    'transferencias_estoque',
    'ajustes_estoque',
    'inventarios_fisicos',
    'inventarios_fisicos_itens',
    'configuracoes_inventario'
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
-- Funções de saldo seguro (transacional)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estoque_aplicar_movimento(
  p_item_id uuid,
  p_local_estoque_id uuid,
  p_tipo public.estoque_movimento_tipo,
  p_quantidade numeric,
  p_motivo text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_origem_tabela text DEFAULT NULL,
  p_origem_id uuid DEFAULT NULL,
  p_fornecedor_id uuid DEFAULT NULL,
  p_veiculo_id uuid DEFAULT NULL,
  p_ordem_servico_id uuid DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL,
  p_custo_unitario numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_config public.configuracoes_inventario;
  v_estoque public.estoques;
  v_delta numeric;
  v_saldo_anterior numeric;
  v_saldo_posterior numeric;
  v_mov_id uuid;
  v_custo_medio numeric;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida para movimentação.';
  END IF;

  v_empresa_id := public.minha_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não identificada para o usuário atual.';
  END IF;

  SELECT * INTO v_config
  FROM public.configuracoes_inventario
  WHERE empresa_id = v_empresa_id;

  IF NOT FOUND THEN
    INSERT INTO public.configuracoes_inventario (empresa_id)
    VALUES (v_empresa_id)
    ON CONFLICT (empresa_id) DO NOTHING;

    SELECT * INTO v_config
    FROM public.configuracoes_inventario
    WHERE empresa_id = v_empresa_id;
  END IF;

  SELECT * INTO v_estoque
  FROM public.estoques
  WHERE empresa_id = v_empresa_id
    AND item_id = p_item_id
    AND local_estoque_id = p_local_estoque_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.estoques (empresa_id, item_id, local_estoque_id, quantidade, custo_medio)
    VALUES (v_empresa_id, p_item_id, p_local_estoque_id, 0, NULL)
    RETURNING * INTO v_estoque;
  END IF;

  v_saldo_anterior := COALESCE(v_estoque.quantidade, 0);

  v_delta := CASE
    WHEN p_tipo IN ('saida', 'transferencia_saida', 'ajuste_negativo') THEN -p_quantidade
    ELSE p_quantidade
  END;

  v_saldo_posterior := v_saldo_anterior + v_delta;

  IF v_saldo_posterior < 0 AND COALESCE(v_config.permitir_estoque_negativo, false) = false THEN
    RAISE EXCEPTION 'Saldo insuficiente para movimentação.';
  END IF;

  IF v_delta > 0 AND p_custo_unitario IS NOT NULL AND p_custo_unitario >= 0 THEN
    v_custo_medio :=
      CASE
        WHEN v_saldo_posterior <= 0 THEN COALESCE(v_estoque.custo_medio, p_custo_unitario)
        WHEN v_saldo_anterior <= 0 OR v_estoque.custo_medio IS NULL THEN p_custo_unitario
        ELSE ((v_saldo_anterior * v_estoque.custo_medio) + (p_quantidade * p_custo_unitario)) / v_saldo_posterior
      END;
  ELSE
    v_custo_medio := v_estoque.custo_medio;
  END IF;

  UPDATE public.estoques
  SET quantidade = v_saldo_posterior,
      custo_medio = v_custo_medio,
      updated_at = now()
  WHERE id = v_estoque.id;

  INSERT INTO public.movimentacoes_estoque (
    empresa_id,
    item_id,
    local_estoque_id,
    tipo,
    quantidade,
    saldo_anterior,
    saldo_posterior,
    motivo,
    observacao,
    custo_unitario,
    origem_tabela,
    origem_id,
    fornecedor_id,
    veiculo_id,
    ordem_servico_id,
    responsavel_id,
    created_by,
    updated_by
  ) VALUES (
    v_empresa_id,
    p_item_id,
    p_local_estoque_id,
    p_tipo,
    p_quantidade,
    v_saldo_anterior,
    v_saldo_posterior,
    p_motivo,
    p_observacao,
    p_custo_unitario,
    p_origem_tabela,
    p_origem_id,
    p_fornecedor_id,
    p_veiculo_id,
    p_ordem_servico_id,
    p_responsavel_id,
    auth.uid(),
    auth.uid()
  ) RETURNING id INTO v_mov_id;

  RETURN v_mov_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.estoque_registrar_entrada(p_entrada_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entrada public.entradas_estoque;
  v_mov_id uuid;
BEGIN
  SELECT * INTO v_entrada
  FROM public.entradas_estoque
  WHERE id = p_entrada_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada não encontrada.';
  END IF;

  IF v_entrada.status = 'recebido' THEN
    RAISE EXCEPTION 'Entrada já recebida.';
  END IF;

  IF v_entrada.item_id IS NULL OR v_entrada.local_estoque_id IS NULL THEN
    RAISE EXCEPTION 'Entrada sem item/local de estoque.';
  END IF;

  v_mov_id := public.estoque_aplicar_movimento(
    v_entrada.item_id,
    v_entrada.local_estoque_id,
    'entrada',
    COALESCE(v_entrada.quantidade, 0),
    COALESCE(v_entrada.tipo_entrada::text, 'entrada'),
    v_entrada.observacoes,
    'entradas_estoque',
    v_entrada.id,
    v_entrada.fornecedor_id,
    NULL,
    NULL,
    v_entrada.responsavel_id,
    v_entrada.valor_unitario
  );

  UPDATE public.entradas_estoque
  SET status = 'recebido',
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_entrada_id;

  RETURN v_mov_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.estoque_registrar_saida(p_saida_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_saida public.saidas_estoque;
  v_mov_id uuid;
BEGIN
  SELECT * INTO v_saida FROM public.saidas_estoque WHERE id = p_saida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saída não encontrada.';
  END IF;

  v_mov_id := public.estoque_aplicar_movimento(
    v_saida.item_id,
    v_saida.local_estoque_id,
    'saida',
    v_saida.quantidade,
    COALESCE(v_saida.motivo, v_saida.tipo_saida::text),
    v_saida.observacoes,
    'saidas_estoque',
    v_saida.id,
    NULL,
    v_saida.veiculo_id,
    v_saida.ordem_servico_id,
    v_saida.responsavel_id,
    NULL
  );

  RETURN v_mov_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.estoque_transferir(p_transferencia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transf public.transferencias_estoque;
BEGIN
  SELECT * INTO v_transf FROM public.transferencias_estoque WHERE id = p_transferencia_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transferência não encontrada.';
  END IF;

  IF v_transf.local_origem_id = v_transf.local_destino_id THEN
    RAISE EXCEPTION 'Origem e destino não podem ser iguais.';
  END IF;

  PERFORM public.estoque_aplicar_movimento(
    v_transf.item_id,
    v_transf.local_origem_id,
    'transferencia_saida',
    v_transf.quantidade,
    'transferencia_origem',
    v_transf.observacao,
    'transferencias_estoque',
    v_transf.id,
    NULL,
    NULL,
    NULL,
    v_transf.responsavel_id,
    NULL
  );

  PERFORM public.estoque_aplicar_movimento(
    v_transf.item_id,
    v_transf.local_destino_id,
    'transferencia_entrada',
    v_transf.quantidade,
    'transferencia_destino',
    v_transf.observacao,
    'transferencias_estoque',
    v_transf.id,
    NULL,
    NULL,
    NULL,
    v_transf.responsavel_id,
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.estoque_aplicar_ajuste(p_ajuste_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_aj public.ajustes_estoque;
  v_tipo public.estoque_movimento_tipo;
BEGIN
  SELECT * INTO v_aj FROM public.ajustes_estoque WHERE id = p_ajuste_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ajuste não encontrado.';
  END IF;

  IF trim(coalesce(v_aj.motivo, '')) = '' THEN
    RAISE EXCEPTION 'Motivo é obrigatório para ajuste.';
  END IF;

  v_tipo := CASE WHEN v_aj.tipo_ajuste = 'positivo' THEN 'ajuste_positivo'::public.estoque_movimento_tipo ELSE 'ajuste_negativo'::public.estoque_movimento_tipo END;

  RETURN public.estoque_aplicar_movimento(
    v_aj.item_id,
    v_aj.local_estoque_id,
    v_tipo,
    v_aj.quantidade,
    v_aj.motivo,
    v_aj.observacao,
    'ajustes_estoque',
    v_aj.id,
    NULL,
    NULL,
    NULL,
    v_aj.responsavel_id,
    NULL
  );
END;
$$;

-- Atualiza valor total de pedidos de compra automaticamente
CREATE OR REPLACE FUNCTION public.recalcular_total_pedido_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pedido_id uuid;
BEGIN
  v_pedido_id := COALESCE(NEW.pedido_compra_id, OLD.pedido_compra_id);

  UPDATE public.pedidos_compra
  SET valor_total = COALESCE((
    SELECT SUM(COALESCE(valor_total, quantidade * valor_unitario))
    FROM public.pedidos_compra_itens
    WHERE pedido_compra_id = v_pedido_id
  ), 0),
  updated_at = now()
  WHERE id = v_pedido_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_total_pedido_compra_ins ON public.pedidos_compra_itens;
DROP TRIGGER IF EXISTS trg_recalcular_total_pedido_compra_upd ON public.pedidos_compra_itens;
DROP TRIGGER IF EXISTS trg_recalcular_total_pedido_compra_del ON public.pedidos_compra_itens;

CREATE TRIGGER trg_recalcular_total_pedido_compra_ins
AFTER INSERT ON public.pedidos_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.recalcular_total_pedido_compra();

CREATE TRIGGER trg_recalcular_total_pedido_compra_upd
AFTER UPDATE ON public.pedidos_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.recalcular_total_pedido_compra();

CREATE TRIGGER trg_recalcular_total_pedido_compra_del
AFTER DELETE ON public.pedidos_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.recalcular_total_pedido_compra();
