-- =============================================================================
-- MasterFleetBR — Migration completa (tabelas operacionais)
-- Execute no SQL Editor do Supabase APÓS o schema_inicial
-- =============================================================================

-- ─────────────────────────────────────────────────────
-- HELPER: empresa_id do usuário logado
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.minha_empresa_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────
-- RPC: is_super_admin (para o Painel Master)
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Substitua pelo seu user_id real do Supabase Auth
  RETURN auth.uid()::text = current_setting('app.super_admin_uid', true);
END;
$$;

-- ─────────────────────────────────────────────────────
-- CLIENTES
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  tipo         text NOT NULL DEFAULT 'pessoa' CHECK (tipo IN ('pessoa', 'empresa')),
  cpf_cnpj     text,
  email        text,
  telefone     text,
  whatsapp     text,
  endereco     text,
  cidade       text,
  estado       text,
  cep          text,
  observacoes  text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_empresa" ON public.clientes USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_clientes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_clientes_empresa
  BEFORE INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_clientes();

-- ─────────────────────────────────────────────────────
-- VEÍCULOS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.veiculos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id             uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  placa                  text NOT NULL,
  renavam                text,
  chassi                 text,
  tipo                   text,
  marca                  text,
  modelo                 text,
  ano_fabricacao         int,
  ano_modelo             int,
  cor                    text,
  capacidade_passageiros int,
  status                 text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'manutencao', 'inativo')),
  km_atual               numeric,
  observacoes            text,
  created_at             timestamptz DEFAULT now()
);

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "veiculos_empresa" ON public.veiculos USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "veiculos_insert" ON public.veiculos FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "veiculos_update" ON public.veiculos FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "veiculos_delete" ON public.veiculos FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_veiculos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_veiculos_empresa
  BEFORE INSERT ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_veiculos();

-- ─────────────────────────────────────────────────────
-- MOTORISTAS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.motoristas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  cpf          text,
  cnh          text,
  categoria_cnh text,
  validade_cnh date,
  telefone     text,
  whatsapp     text,
  email        text,
  endereco     text,
  observacoes  text,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "motoristas_empresa" ON public.motoristas USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "motoristas_insert" ON public.motoristas FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "motoristas_update" ON public.motoristas FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "motoristas_delete" ON public.motoristas FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_motoristas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_motoristas_empresa
  BEFORE INSERT ON public.motoristas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_motoristas();

-- ─────────────────────────────────────────────────────
-- OS COUNTERS (numeração automática por empresa)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.os_counters (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  ultimo_numero int NOT NULL DEFAULT 0
);

ALTER TABLE public.os_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_counters_empresa" ON public.os_counters USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.proximo_numero_os(p_empresa_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_num int;
BEGIN
  INSERT INTO public.os_counters (empresa_id, ultimo_numero)
  VALUES (p_empresa_id, 1)
  ON CONFLICT (empresa_id) DO UPDATE
    SET ultimo_numero = os_counters.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_num;
  RETURN v_num;
END;
$$;

-- ─────────────────────────────────────────────────────
-- ORDENS DE SERVIÇO
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero           int,
  tipo             text NOT NULL DEFAULT 'eventual' CHECK (tipo IN ('eventual', 'recorrente')),
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'em_execucao', 'concluida', 'cancelada')),
  status_pagamento text NOT NULL DEFAULT 'pendente'
                   CHECK (status_pagamento IN ('pendente', 'pago', 'parcial', 'cancelado')),
  cliente_id       uuid REFERENCES public.clientes(id),
  veiculo_id       uuid REFERENCES public.veiculos(id),
  motorista_id     uuid REFERENCES public.motoristas(id),
  contrato_id      uuid,
  inicio_em        timestamptz,
  fim_em           timestamptz,
  origem           text,
  destino          text,
  valor_total      numeric DEFAULT 0,
  km_inicial       numeric,
  km_final         numeric,
  observacoes      text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "os_empresa" ON public.ordens_servico USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "os_insert" ON public.ordens_servico FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "os_update" ON public.ordens_servico FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "os_delete" ON public.ordens_servico FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_numero_os()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  IF NEW.numero IS NULL THEN
    NEW.numero := public.proximo_numero_os(NEW.empresa_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_os_numero
  BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_os();

CREATE OR REPLACE FUNCTION public.set_updated_at_os()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_os_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_os();

-- ─────────────────────────────────────────────────────
-- CONTRATOS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contratos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id   uuid NOT NULL REFERENCES public.clientes(id),
  nome         text NOT NULL,
  descricao    text,
  dias_semana  int[] DEFAULT '{}',
  data_inicio  date,
  data_fim     date,
  ativo        boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contratos_empresa" ON public.contratos USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "contratos_insert" ON public.contratos FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "contratos_update" ON public.contratos FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "contratos_delete" ON public.contratos FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_contratos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_contratos_empresa
  BEFORE INSERT ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_contratos();

-- HORÁRIOS DO CONTRATO
CREATE TABLE IF NOT EXISTS public.contrato_horarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id  uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  horario      time NOT NULL,
  origem       text,
  destino      text,
  veiculo_id   uuid REFERENCES public.veiculos(id),
  motorista_id uuid REFERENCES public.motoristas(id),
  observacao   text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.contrato_horarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contrato_horarios_empresa" ON public.contrato_horarios USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "contrato_horarios_insert" ON public.contrato_horarios FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "contrato_horarios_update" ON public.contrato_horarios FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "contrato_horarios_delete" ON public.contrato_horarios FOR DELETE USING (empresa_id = public.minha_empresa_id());

-- ─────────────────────────────────────────────────────
-- INVENTÁRIO: PRODUTOS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.produtos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome            text NOT NULL,
  descricao       text,
  unidade         text NOT NULL DEFAULT 'un',
  categoria       text,
  preco_custo     numeric,
  estoque_minimo  numeric DEFAULT 0,
  destaque        boolean DEFAULT false,
  ativo           boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos_empresa" ON public.produtos USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "produtos_insert" ON public.produtos FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "produtos_update" ON public.produtos FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "produtos_delete" ON public.produtos FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_produtos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_produtos_empresa
  BEFORE INSERT ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_produtos();

-- Máximo 3 destaques por empresa
CREATE OR REPLACE FUNCTION public.check_max_destaques()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.destaque = true THEN
    IF (SELECT COUNT(*) FROM public.produtos
        WHERE empresa_id = NEW.empresa_id AND destaque = true AND id <> NEW.id) >= 3 THEN
      RAISE EXCEPTION 'Máximo de 3 produtos em destaque por empresa.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_max_destaques
  BEFORE INSERT OR UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.check_max_destaques();

-- ─────────────────────────────────────────────────────
-- INVENTÁRIO: DEPÓSITOS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.depositos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  descricao  text,
  ativo      boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depositos_empresa" ON public.depositos USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "depositos_insert" ON public.depositos FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "depositos_update" ON public.depositos FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "depositos_delete" ON public.depositos FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_depositos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_depositos_empresa
  BEFORE INSERT ON public.depositos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_depositos();

-- ─────────────────────────────────────────────────────
-- INVENTÁRIO: SALDOS (mantidos por trigger)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saldos_estoque (
  produto_id  uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  deposito_id uuid NOT NULL REFERENCES public.depositos(id) ON DELETE CASCADE,
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  quantidade  numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (produto_id, deposito_id)
);

ALTER TABLE public.saldos_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saldos_empresa" ON public.saldos_estoque USING (empresa_id = public.minha_empresa_id());

-- ─────────────────────────────────────────────────────
-- INVENTÁRIO: MOVIMENTOS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.movimentos_estoque (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id  uuid NOT NULL REFERENCES public.produtos(id),
  deposito_id uuid NOT NULL REFERENCES public.depositos(id),
  tipo        text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
  quantidade  numeric NOT NULL,
  origem      text,
  referencia_id uuid,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.movimentos_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimentos_empresa" ON public.movimentos_estoque USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "movimentos_insert" ON public.movimentos_estoque FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());

-- Trigger: atualiza saldo_estoque após movimento
CREATE OR REPLACE FUNCTION public.atualizar_saldo_estoque()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_delta numeric;
BEGIN
  v_delta := CASE WHEN NEW.tipo = 'saida' THEN -NEW.quantidade ELSE NEW.quantidade END;
  INSERT INTO public.saldos_estoque (produto_id, deposito_id, empresa_id, quantidade)
  VALUES (NEW.produto_id, NEW.deposito_id, NEW.empresa_id, v_delta)
  ON CONFLICT (produto_id, deposito_id) DO UPDATE
    SET quantidade = saldos_estoque.quantidade + v_delta;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_atualizar_saldo
  AFTER INSERT ON public.movimentos_estoque
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_saldo_estoque();

-- ─────────────────────────────────────────────────────
-- INVENTÁRIO: ENTRADAS DE ESTOQUE
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entradas_estoque (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero         int,
  produto_id     uuid NOT NULL REFERENCES public.produtos(id),
  deposito_id    uuid NOT NULL REFERENCES public.depositos(id),
  quantidade     numeric NOT NULL,
  valor_unitario numeric,
  valor_total    numeric,
  nota_fiscal    text,
  fornecedor     text,
  data_entrada   date,
  observacoes    text,
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'cancelado')),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.entradas_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entradas_empresa" ON public.entradas_estoque USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "entradas_insert" ON public.entradas_estoque FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "entradas_update" ON public.entradas_estoque FOR UPDATE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_entradas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_entradas_empresa
  BEFORE INSERT ON public.entradas_estoque
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_entradas();

-- RPC: confirmar recebimento de entrada
CREATE OR REPLACE FUNCTION public.rpc_receber_entrada(entrada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_entrada public.entradas_estoque;
BEGIN
  SELECT * INTO v_entrada FROM public.entradas_estoque WHERE id = entrada_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;
  IF v_entrada.status <> 'pendente' THEN RAISE EXCEPTION 'Entrada já processada.'; END IF;

  INSERT INTO public.movimentos_estoque (empresa_id, produto_id, deposito_id, tipo, quantidade, origem, referencia_id)
  VALUES (v_entrada.empresa_id, v_entrada.produto_id, v_entrada.deposito_id, 'entrada', v_entrada.quantidade, 'entrada_estoque', entrada_id);

  UPDATE public.entradas_estoque SET status = 'recebido' WHERE id = entrada_id;
END;
$$;

-- RPC: cancelar entrada
CREATE OR REPLACE FUNCTION public.rpc_cancelar_entrada(entrada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_entrada public.entradas_estoque;
BEGIN
  SELECT * INTO v_entrada FROM public.entradas_estoque WHERE id = entrada_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrada não encontrada.'; END IF;
  IF v_entrada.status = 'recebido' THEN
    INSERT INTO public.movimentos_estoque (empresa_id, produto_id, deposito_id, tipo, quantidade, origem, referencia_id)
    VALUES (v_entrada.empresa_id, v_entrada.produto_id, v_entrada.deposito_id, 'saida', v_entrada.quantidade, 'cancelamento_entrada', entrada_id);
  END IF;
  UPDATE public.entradas_estoque SET status = 'cancelado' WHERE id = entrada_id;
END;
$$;

-- ─────────────────────────────────────────────────────
-- FINANCEIRO: CONTAS
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contas_financeiras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao        text NOT NULL,
  tipo             text NOT NULL CHECK (tipo IN ('pagar', 'receber')),
  valor            numeric NOT NULL,
  data_vencimento  date NOT NULL,
  data_pagamento   date,
  status           text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'pago', 'recebido', 'cancelado')),
  categoria        text,
  observacoes      text,
  os_id            uuid REFERENCES public.ordens_servico(id),
  contrato_id      uuid REFERENCES public.contratos(id),
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.contas_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contas_empresa" ON public.contas_financeiras USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "contas_insert" ON public.contas_financeiras FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "contas_update" ON public.contas_financeiras FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "contas_delete" ON public.contas_financeiras FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_contas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_contas_empresa
  BEFORE INSERT ON public.contas_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_contas();

-- ─────────────────────────────────────────────────────
-- FINANCEIRO: FATURAS (assinatura SaaS)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.faturas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  assinatura_id   uuid REFERENCES public.assinaturas(id),
  valor_centavos  bigint NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta', 'paga', 'cancelada', 'expirada')),
  vencimento      date,
  pix_qr_code     text,
  pix_copia_cola  text,
  mp_payment_id   text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faturas_empresa" ON public.faturas
  FOR SELECT USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "faturas_insert_service" ON public.faturas
  FOR INSERT WITH CHECK (true);
CREATE POLICY "faturas_update_service" ON public.faturas
  FOR UPDATE USING (true);

-- ─────────────────────────────────────────────────────
-- FINANCEIRO: PAGAMENTOS (log de webhooks MP)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source     text,
  payload    jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_logs_service" ON public.webhook_logs FOR INSERT WITH CHECK (true);

-- ─────────────────────────────────────────────────────
-- MANUTENÇÃO
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manutencoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id     uuid NOT NULL REFERENCES public.veiculos(id),
  tipo           text NOT NULL DEFAULT 'Preventiva',
  descricao      text NOT NULL,
  status         text NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  data_prevista  date,
  data_realizada date,
  km_previsto    int,
  km_realizado   int,
  custo          numeric,
  observacoes    text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manutencoes_empresa" ON public.manutencoes USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "manutencoes_insert" ON public.manutencoes FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "manutencoes_update" ON public.manutencoes FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "manutencoes_delete" ON public.manutencoes FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_manutencoes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN NEW.empresa_id := public.minha_empresa_id(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_manutencoes_empresa
  BEFORE INSERT ON public.manutencoes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_manutencoes();

-- ─────────────────────────────────────────────────────
-- ÍNDICES (performance)
-- ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clientes_empresa      ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_empresa      ON public.veiculos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_motoristas_empresa    ON public.motoristas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_os_empresa            ON public.ordens_servico(empresa_id);
CREATE INDEX IF NOT EXISTS idx_os_status             ON public.ordens_servico(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_contratos_empresa     ON public.contratos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa      ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_produto    ON public.movimentos_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_entradas_empresa      ON public.entradas_estoque(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_empresa        ON public.contas_financeiras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_vencimento     ON public.contas_financeiras(empresa_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_faturas_empresa       ON public.faturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_empresa   ON public.manutencoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo   ON public.manutencoes(veiculo_id);
