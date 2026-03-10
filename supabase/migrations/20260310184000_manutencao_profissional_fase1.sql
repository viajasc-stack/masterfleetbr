-- Manutenção profissional — Fase 1
-- Base: solicitação → triagem → diagnóstico → aprovação → suprimentos → execução → conclusão

-- 1) Evolução do cadastro de manutenção
ALTER TABLE public.manutencoes
  ADD COLUMN IF NOT EXISTS numero int,
  ADD COLUMN IF NOT EXISTS origem_solicitacao text NOT NULL DEFAULT 'interno',
  ADD COLUMN IF NOT EXISTS solicitante_tipo text NOT NULL DEFAULT 'administrativo',
  ADD COLUMN IF NOT EXISTS solicitante_id uuid,
  ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS urgencia text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS pode_rodar text NOT NULL DEFAULT 'sim',
  ADD COLUMN IF NOT EXISTS local_ocorrencia text,
  ADD COLUMN IF NOT EXISTS ocorrido_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS km_ocorrencia numeric,
  ADD COLUMN IF NOT EXISTS sintomas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS triagem_notas text,
  ADD COLUMN IF NOT EXISTS triagem_decisao text,
  ADD COLUMN IF NOT EXISTS triado_por uuid,
  ADD COLUMN IF NOT EXISTS triado_em timestamptz,
  ADD COLUMN IF NOT EXISTS sintoma_relatado text,
  ADD COLUMN IF NOT EXISTS diagnostico_tecnico text,
  ADD COLUMN IF NOT EXISTS causa_raiz text,
  ADD COLUMN IF NOT EXISTS solucao_planejada text,
  ADD COLUMN IF NOT EXISTS prioridade_real text,
  ADD COLUMN IF NOT EXISTS risco_operacional text,
  ADD COLUMN IF NOT EXISTS tipo_execucao text,
  ADD COLUMN IF NOT EXISTS previsao_horas numeric,
  ADD COLUMN IF NOT EXISTS previsao_custo numeric,
  ADD COLUMN IF NOT EXISTS diagnostico_por uuid,
  ADD COLUMN IF NOT EXISTS diagnostico_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_requerida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovacao_status text NOT NULL DEFAULT 'nao_aplicavel',
  ADD COLUMN IF NOT EXISTS valor_aprovacao numeric,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_observacoes text,
  ADD COLUMN IF NOT EXISTS inicio_execucao_em timestamptz,
  ADD COLUMN IF NOT EXISTS fim_execucao_em timestamptz,
  ADD COLUMN IF NOT EXISTS local_execucao text,
  ADD COLUMN IF NOT EXISTS oficina_externa_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mecanico_responsavel text,
  ADD COLUMN IF NOT EXISTS custo_pecas numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_mao_obra numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_terceiros numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_extras numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS km_final numeric,
  ADD COLUMN IF NOT EXISTS veiculo_liberado boolean,
  ADD COLUMN IF NOT EXISTS recomendacao_futura text;

-- Compatibilidade de custo legado
UPDATE public.manutencoes
SET custo_total = COALESCE(custo_total, custo, 0)
WHERE COALESCE(custo_total, 0) = 0
  AND COALESCE(custo, 0) > 0;

-- 2) Estados operacionais do veículo (sem quebrar campo legado "status")
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS estado_operacional text NOT NULL DEFAULT 'disponivel';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.veiculos'::regclass
      AND conname = 'veiculos_estado_operacional_check'
  ) THEN
    ALTER TABLE public.veiculos
      ADD CONSTRAINT veiculos_estado_operacional_check
      CHECK (
        estado_operacional IN (
          'disponivel',
          'restrito',
          'bloqueado_operacao',
          'em_manutencao',
          'aguardando_peca',
          'liberado_observacao'
        )
      );
  END IF;
END
$$;

-- 3) Novo fluxo de status da manutenção
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.manutencoes'::regclass
      AND conname = 'manutencoes_status_check'
  ) THEN
    ALTER TABLE public.manutencoes DROP CONSTRAINT manutencoes_status_check;
  END IF;
END
$$;

ALTER TABLE public.manutencoes
  ADD CONSTRAINT manutencoes_status_check
  CHECK (
    status IN (
      'pendente',
      'em_triagem',
      'aguardando_complemento',
      'aprovada_analise',
      'cancelada',
      'em_analise',
      'analisada',
      'aguardando_orcamento',
      'aguardando_aprovacao',
      'reprovada',
      'aguardando_pecas',
      'pecas_reservadas',
      'compra_solicitada',
      'compra_em_andamento',
      'pecas_recebidas',
      'programada',
      'em_andamento',
      'pausada',
      'aguardando_terceiro',
      'aguardando_liberacao',
      'concluida',
      'concluida_parcial',
      'concluida_observacao',
      'sem_solucao_tecnica',
      'encaminhada_externa'
    )
  );

-- 4) Contador de numeração por empresa
CREATE TABLE IF NOT EXISTS public.manutencao_counters (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ultimo_numero int NOT NULL DEFAULT 0
);

ALTER TABLE public.manutencao_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'manutencao_counters' AND policyname = 'manutencao_counters_empresa'
  ) THEN
    CREATE POLICY "manutencao_counters_empresa"
      ON public.manutencao_counters
      USING (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.proximo_numero_manutencao(p_empresa_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_num int;
BEGIN
  INSERT INTO public.manutencao_counters (empresa_id, ultimo_numero)
  VALUES (p_empresa_id, 1)
  ON CONFLICT (empresa_id) DO UPDATE
    SET ultimo_numero = public.manutencao_counters.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_num;

  RETURN v_num;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_defaults_manutencao_profissional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  NEW.numero := COALESCE(NEW.numero, public.proximo_numero_manutencao(NEW.empresa_id));
  NEW.ocorrido_em := COALESCE(NEW.ocorrido_em, now());
  NEW.custo_total := COALESCE(NEW.custo_total, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencoes_defaults_profissional ON public.manutencoes;
CREATE TRIGGER trg_manutencoes_defaults_profissional
  BEFORE INSERT ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.set_defaults_manutencao_profissional();

-- 5) Timeline/histórico de manutenção
CREATE TABLE IF NOT EXISTS public.manutencao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  manutencao_id uuid NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  de_status text,
  para_status text,
  evento text NOT NULL,
  detalhes jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manutencao_historico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_historico' AND policyname = 'manutencao_historico_empresa'
  ) THEN
    CREATE POLICY "manutencao_historico_empresa" ON public.manutencao_historico
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_historico' AND policyname = 'manutencao_historico_insert'
  ) THEN
    CREATE POLICY "manutencao_historico_insert" ON public.manutencao_historico
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.manutencao_registrar_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.manutencao_historico (
      empresa_id,
      manutencao_id,
      de_status,
      para_status,
      evento,
      detalhes
    )
    VALUES (
      NEW.empresa_id,
      NEW.id,
      NULL,
      NEW.status,
      'abertura_solicitacao',
      jsonb_build_object('descricao', NEW.descricao, 'urgencia', NEW.urgencia, 'pode_rodar', NEW.pode_rodar)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.manutencao_historico (
      empresa_id,
      manutencao_id,
      de_status,
      para_status,
      evento,
      detalhes
    )
    VALUES (
      NEW.empresa_id,
      NEW.id,
      OLD.status,
      NEW.status,
      'mudanca_status',
      jsonb_build_object('updated_at', now())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencao_historico_insert ON public.manutencoes;
CREATE TRIGGER trg_manutencao_historico_insert
  AFTER INSERT ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.manutencao_registrar_historico();

DROP TRIGGER IF EXISTS trg_manutencao_historico_update ON public.manutencoes;
CREATE TRIGGER trg_manutencao_historico_update
  AFTER UPDATE ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.manutencao_registrar_historico();

-- 6) Itens da manutenção com reserva/uso em estoque
CREATE TABLE IF NOT EXISTS public.manutencao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  manutencao_id uuid NOT NULL REFERENCES public.manutencoes(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id),
  deposito_id uuid NOT NULL REFERENCES public.depositos(id),
  quantidade_solicitada numeric NOT NULL CHECK (quantidade_solicitada > 0),
  quantidade_reservada numeric NOT NULL DEFAULT 0 CHECK (quantidade_reservada >= 0),
  quantidade_aplicada numeric NOT NULL DEFAULT 0 CHECK (quantidade_aplicada >= 0),
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'reservado', 'aplicado', 'devolvido', 'cancelado')),
  valor_unitario numeric,
  valor_total numeric,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manutencao_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_itens' AND policyname = 'manutencao_itens_empresa'
  ) THEN
    CREATE POLICY "manutencao_itens_empresa" ON public.manutencao_itens USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_itens' AND policyname = 'manutencao_itens_insert'
  ) THEN
    CREATE POLICY "manutencao_itens_insert" ON public.manutencao_itens FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_itens' AND policyname = 'manutencao_itens_update'
  ) THEN
    CREATE POLICY "manutencao_itens_update" ON public.manutencao_itens FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'manutencao_itens' AND policyname = 'manutencao_itens_delete'
  ) THEN
    CREATE POLICY "manutencao_itens_delete" ON public.manutencao_itens FOR DELETE USING (empresa_id = public.minha_empresa_id());
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_manutencao_itens()
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
    RAISE EXCEPTION 'Manutenção não encontrada para item.';
  END IF;

  NEW.empresa_id := v_empresa_id;
  NEW.valor_total := COALESCE(NEW.valor_total, COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade_reservada, NEW.quantidade_solicitada, 0));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencao_itens_empresa ON public.manutencao_itens;
CREATE TRIGGER trg_manutencao_itens_empresa
  BEFORE INSERT OR UPDATE ON public.manutencao_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_manutencao_itens();

-- 7) Sincroniza estado operacional do veículo
CREATE OR REPLACE FUNCTION public.manutencao_sync_estado_operacional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estado text;
BEGIN
  IF NEW.status IN ('aguardando_pecas', 'compra_solicitada', 'compra_em_andamento') THEN
    v_estado := 'aguardando_peca';
  ELSIF NEW.status IN ('concluida_parcial', 'concluida_observacao') THEN
    v_estado := 'liberado_observacao';
  ELSIF NEW.status IN ('sem_solucao_tecnica') THEN
    v_estado := 'bloqueado_operacao';
  ELSIF NEW.status IN ('concluida', 'cancelada', 'reprovada') THEN
    v_estado := 'disponivel';
  ELSE
    v_estado := 'em_manutencao';
  END IF;

  IF NEW.urgencia = 'critica' OR NEW.pode_rodar = 'nao' THEN
    v_estado := 'bloqueado_operacao';
  END IF;

  UPDATE public.veiculos
  SET estado_operacional = v_estado
  WHERE id = NEW.veiculo_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manutencao_sync_estado_operacional_insert ON public.manutencoes;
CREATE TRIGGER trg_manutencao_sync_estado_operacional_insert
  AFTER INSERT ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_estado_operacional();

DROP TRIGGER IF EXISTS trg_manutencao_sync_estado_operacional_update ON public.manutencoes;
CREATE TRIGGER trg_manutencao_sync_estado_operacional_update
  AFTER UPDATE OF status, urgencia, pode_rodar ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.manutencao_sync_estado_operacional();

-- 8) RPCs base de fluxo
CREATE OR REPLACE FUNCTION public.rpc_manutencao_solicitar(
  p_veiculo_id uuid,
  p_categoria text,
  p_descricao text,
  p_urgencia text DEFAULT 'media',
  p_pode_rodar text DEFAULT 'sim',
  p_km_ocorrencia numeric DEFAULT NULL,
  p_local_ocorrencia text DEFAULT NULL,
  p_ocorrido_em timestamptz DEFAULT now(),
  p_sintomas jsonb DEFAULT '[]'::jsonb,
  p_anexos jsonb DEFAULT '[]'::jsonb,
  p_origem_solicitacao text DEFAULT 'motorista',
  p_solicitante_tipo text DEFAULT 'motorista',
  p_solicitante_id uuid DEFAULT NULL,
  p_motorista_id uuid DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.manutencoes (
    empresa_id,
    veiculo_id,
    tipo,
    descricao,
    status,
    categoria,
    urgencia,
    pode_rodar,
    km_ocorrencia,
    local_ocorrencia,
    ocorrido_em,
    sintomas,
    anexos,
    origem_solicitacao,
    solicitante_tipo,
    solicitante_id,
    motorista_id,
    observacoes
  ) VALUES (
    public.minha_empresa_id(),
    p_veiculo_id,
    'Corretiva',
    p_descricao,
    'pendente',
    p_categoria,
    COALESCE(p_urgencia, 'media'),
    COALESCE(p_pode_rodar, 'sim'),
    p_km_ocorrencia,
    p_local_ocorrencia,
    COALESCE(p_ocorrido_em, now()),
    COALESCE(p_sintomas, '[]'::jsonb),
    COALESCE(p_anexos, '[]'::jsonb),
    COALESCE(p_origem_solicitacao, 'motorista'),
    COALESCE(p_solicitante_tipo, 'motorista'),
    p_solicitante_id,
    p_motorista_id,
    p_observacoes
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manutencao_atualizar_status(
  p_manutencao_id uuid,
  p_novo_status text,
  p_observacoes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.manutencoes
  SET
    status = p_novo_status,
    observacoes = COALESCE(
      NULLIF(observacoes, '') || CASE WHEN p_observacoes IS NOT NULL THEN E'\n' || p_observacoes ELSE '' END,
      p_observacoes,
      observacoes
    )
  WHERE id = p_manutencao_id
    AND empresa_id = public.minha_empresa_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manutenção não encontrada para atualização de status.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manutencao_concluir(
  p_manutencao_id uuid,
  p_status_final text DEFAULT 'concluida',
  p_km_final numeric DEFAULT NULL,
  p_custo_mao_obra numeric DEFAULT NULL,
  p_custo_terceiros numeric DEFAULT NULL,
  p_custo_extras numeric DEFAULT NULL,
  p_recomendacao text DEFAULT NULL,
  p_veiculo_liberado boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.manutencoes
  SET
    status = p_status_final,
    data_realizada = COALESCE(data_realizada, now()::date),
    fim_execucao_em = COALESCE(fim_execucao_em, now()),
    km_final = COALESCE(p_km_final, km_final),
    km_realizado = COALESCE(km_realizado, p_km_final::int),
    custo_mao_obra = COALESCE(p_custo_mao_obra, custo_mao_obra, 0),
    custo_terceiros = COALESCE(p_custo_terceiros, custo_terceiros, 0),
    custo_extras = COALESCE(p_custo_extras, custo_extras, 0),
    recomendacao_futura = COALESCE(p_recomendacao, recomendacao_futura),
    veiculo_liberado = COALESCE(p_veiculo_liberado, veiculo_liberado),
    custo_total = COALESCE(custo_pecas, 0)
      + COALESCE(COALESCE(p_custo_mao_obra, custo_mao_obra), 0)
      + COALESCE(COALESCE(p_custo_terceiros, custo_terceiros), 0)
      + COALESCE(COALESCE(p_custo_extras, custo_extras), 0),
    custo = COALESCE(custo, 0)
  WHERE id = p_manutencao_id
    AND empresa_id = public.minha_empresa_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manutenção não encontrada para conclusão.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manutencao_reservar_item(
  p_manutencao_id uuid,
  p_produto_id uuid,
  p_deposito_id uuid,
  p_quantidade numeric,
  p_valor_unitario numeric DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id uuid;
  v_saldo numeric := 0;
  v_reservado numeric := 0;
  v_disponivel numeric := 0;
  v_item_id uuid;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida para reserva.';
  END IF;

  SELECT empresa_id INTO v_empresa_id
  FROM public.manutencoes
  WHERE id = p_manutencao_id
    AND empresa_id = public.minha_empresa_id();

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Manutenção não encontrada para reserva.';
  END IF;

  SELECT COALESCE(se.quantidade, 0)
    INTO v_saldo
  FROM public.saldos_estoque se
  WHERE se.produto_id = p_produto_id
    AND se.deposito_id = p_deposito_id
    AND se.empresa_id = v_empresa_id;

  SELECT COALESCE(SUM(mi.quantidade_reservada), 0)
    INTO v_reservado
  FROM public.manutencao_itens mi
  WHERE mi.empresa_id = v_empresa_id
    AND mi.produto_id = p_produto_id
    AND mi.deposito_id = p_deposito_id
    AND mi.status = 'reservado';

  v_disponivel := v_saldo - v_reservado;

  IF v_disponivel < p_quantidade THEN
    RAISE EXCEPTION 'Estoque indisponível para reserva. Disponível: %, solicitado: %', v_disponivel, p_quantidade;
  END IF;

  INSERT INTO public.manutencao_itens (
    empresa_id,
    manutencao_id,
    produto_id,
    deposito_id,
    quantidade_solicitada,
    quantidade_reservada,
    status,
    valor_unitario,
    valor_total,
    observacoes
  ) VALUES (
    v_empresa_id,
    p_manutencao_id,
    p_produto_id,
    p_deposito_id,
    p_quantidade,
    p_quantidade,
    'reservado',
    p_valor_unitario,
    COALESCE(p_valor_unitario, 0) * p_quantidade,
    p_observacoes
  ) RETURNING id INTO v_item_id;

  UPDATE public.manutencoes
  SET status = CASE
    WHEN status IN ('aguardando_pecas', 'compra_solicitada', 'compra_em_andamento', 'pecas_recebidas') THEN 'pecas_reservadas'
    ELSE status
  END
  WHERE id = p_manutencao_id;

  RETURN v_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manutencao_cancelar_reserva_item(
  p_item_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item public.manutencao_itens;
BEGIN
  SELECT * INTO v_item
  FROM public.manutencao_itens
  WHERE id = p_item_id
    AND empresa_id = public.minha_empresa_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de manutenção não encontrado.';
  END IF;

  UPDATE public.manutencao_itens
  SET
    status = 'cancelado',
    quantidade_reservada = 0,
    observacoes = COALESCE(
      NULLIF(observacoes, '') || CASE WHEN p_observacao IS NOT NULL THEN E'\n' || p_observacao ELSE '' END,
      p_observacao,
      observacoes
    )
  WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_manutencao_aplicar_item(
  p_item_id uuid,
  p_quantidade numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item public.manutencao_itens;
  v_manutencao public.manutencoes;
  v_qtd numeric;
  v_valor_total numeric;
BEGIN
  SELECT * INTO v_item
  FROM public.manutencao_itens
  WHERE id = p_item_id
    AND empresa_id = public.minha_empresa_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de manutenção não encontrado para aplicação.';
  END IF;

  IF v_item.status <> 'reservado' THEN
    RAISE EXCEPTION 'Somente itens reservados podem ser aplicados.';
  END IF;

  SELECT * INTO v_manutencao
  FROM public.manutencoes
  WHERE id = v_item.manutencao_id
    AND empresa_id = public.minha_empresa_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manutenção relacionada ao item não encontrada.';
  END IF;

  v_qtd := COALESCE(p_quantidade, v_item.quantidade_reservada);

  IF v_qtd <= 0 OR v_qtd > v_item.quantidade_reservada THEN
    RAISE EXCEPTION 'Quantidade inválida para aplicação de item.';
  END IF;

  v_valor_total := COALESCE(v_item.valor_unitario, 0) * v_qtd;

  INSERT INTO public.movimentos_estoque (
    empresa_id,
    produto_id,
    deposito_id,
    tipo,
    quantidade,
    origem,
    referencia_id,
    valor_unitario,
    valor_total,
    manutencao_id,
    veiculo_id
  ) VALUES (
    v_item.empresa_id,
    v_item.produto_id,
    v_item.deposito_id,
    'saida',
    v_qtd,
    'manutencao',
    v_item.id,
    v_item.valor_unitario,
    v_valor_total,
    v_item.manutencao_id,
    v_manutencao.veiculo_id
  );

  UPDATE public.manutencao_itens
  SET
    quantidade_reservada = quantidade_reservada - v_qtd,
    quantidade_aplicada = quantidade_aplicada + v_qtd,
    status = CASE WHEN (quantidade_reservada - v_qtd) <= 0 THEN 'aplicado' ELSE 'reservado' END,
    valor_total = COALESCE(valor_unitario, 0) * (quantidade_aplicada + v_qtd)
  WHERE id = p_item_id;

  UPDATE public.manutencoes
  SET
    custo_pecas = COALESCE(custo_pecas, 0) + v_valor_total,
    custo_total = COALESCE(custo_pecas, 0) + v_valor_total
      + COALESCE(custo_mao_obra, 0)
      + COALESCE(custo_terceiros, 0)
      + COALESCE(custo_extras, 0)
  WHERE id = v_item.manutencao_id;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_manutencoes_numero_empresa ON public.manutencoes(empresa_id, numero DESC);
CREATE INDEX IF NOT EXISTS idx_manutencoes_status_fluxo ON public.manutencoes(empresa_id, status, urgencia);
CREATE INDEX IF NOT EXISTS idx_manutencao_historico_manutencao ON public.manutencao_historico(manutencao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manutencao_itens_manutencao ON public.manutencao_itens(manutencao_id);
CREATE INDEX IF NOT EXISTS idx_manutencao_itens_produto_status ON public.manutencao_itens(produto_id, deposito_id, status);
