-- =============================================================================
-- MasterFleetBR - Billing modular (módulos em vez de planos)
-- Estratégia:
-- 1) mantém compatibilidade com planos legados
-- 2) adiciona catálogo comercial por módulo
-- 3) vincula módulos por empresa
-- 4) passa controle de acesso e cobrança a usar módulos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EVOLUÇÃO DO CATÁLOGO GLOBAL DE MÓDULOS
-- -----------------------------------------------------------------------------
ALTER TABLE public.modulos_globais
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'operacional',
  ADD COLUMN IF NOT EXISTS preco_centavos bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ordem int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS venda_ativa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.modulos_globais (codigo, nome, descricao, ativo, categoria, preco_centavos, ordem, venda_ativa)
VALUES
  ('dashboard', 'Dashboard', 'Visão geral operacional', true, 'base', 0, 10, true),
  ('configuracoes', 'Configurações', 'Configurações gerais e integrações', true, 'base', 0, 20, true),
  ('usuarios', 'Usuários', 'Gestão de usuários da empresa', true, 'base', 0, 30, true),
  ('suporte', 'Suporte', 'Atendimento e comunicação de suporte', true, 'base', 0, 40, true),
  ('ordens_servico', 'Ordens de serviço', 'OS, orçamentos, contratos e fretamentos', true, 'operacional', 14900, 100, true),
  ('clientes', 'Clientes', 'Cadastros e relacionamento de clientes', true, 'operacional', 3900, 110, true),
  ('veiculos', 'Veículos', 'Gestão de frota e dados dos veículos', true, 'operacional', 4900, 120, true),
  ('motoristas', 'Motoristas', 'Cadastros e operação de motoristas', true, 'operacional', 3900, 130, true),
  ('inventario', 'Inventário', 'Estoque, entradas, saídas e compras', true, 'gestao', 6900, 200, true),
  ('financeiro', 'Financeiro', 'Contas, faturas e cobrança', true, 'gestao', 8900, 210, true),
  ('manutencao', 'Manutenção', 'Planos, ordens e custos de manutenção', true, 'gestao', 11900, 220, true),
  ('oficina', 'Oficina', 'Gestão de oficina interna e OTs', true, 'gestao', 12900, 230, true),
  ('agenda', 'Agenda', 'Agenda operacional e integrações calendário', true, 'gestao', 2900, 240, true),
  ('viagens', 'Viagens', 'Gestão de viagens e pedidos', true, 'gestao', 5900, 250, true),
  ('relatorios', 'Relatórios', 'Relatórios, BI, telemetria e observabilidade', true, 'analytics', 6900, 300, true),
  ('api_integracoes', 'API e integrações', 'Integrações externas e APIs', true, 'expansao', 9900, 400, true),
  ('automacoes', 'Automações', 'Automações operacionais e alertas', true, 'expansao', 11900, 410, true)
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  preco_centavos = EXCLUDED.preco_centavos,
  ordem = EXCLUDED.ordem,
  venda_ativa = EXCLUDED.venda_ativa;

-- -----------------------------------------------------------------------------
-- 2. EMPRESA ↔ MÓDULOS CONTRATADOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresa_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  modulo_codigo text NOT NULL REFERENCES public.modulos_globais(codigo) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'suspensa', 'cancelada')),
  origem text NOT NULL DEFAULT 'manual',
  preco_centavos bigint NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, modulo_codigo)
);

CREATE INDEX IF NOT EXISTS idx_empresa_modulos_empresa_status
  ON public.empresa_modulos (empresa_id, status, modulo_codigo);

CREATE OR REPLACE FUNCTION public.set_empresa_modulos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresa_modulos_updated_at ON public.empresa_modulos;
CREATE TRIGGER trg_empresa_modulos_updated_at
BEFORE UPDATE ON public.empresa_modulos
FOR EACH ROW EXECUTE FUNCTION public.set_empresa_modulos_updated_at();

ALTER TABLE public.empresa_modulos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_modulos_select_own_or_master ON public.empresa_modulos;
CREATE POLICY empresa_modulos_select_own_or_master
ON public.empresa_modulos
FOR SELECT
USING (
  empresa_id = public.minha_empresa_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS empresa_modulos_master_write ON public.empresa_modulos;
CREATE POLICY empresa_modulos_master_write
ON public.empresa_modulos
FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 3. ASSINATURA: MODELO DE COBRANÇA
-- -----------------------------------------------------------------------------
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'plano'
  CHECK (billing_model IN ('plano', 'modular'));

-- -----------------------------------------------------------------------------
-- 4. HELPERS DE MÓDULOS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_empresa_modulos_base(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.empresa_modulos (empresa_id, modulo_codigo, status, origem, preco_centavos)
  VALUES
    (p_empresa_id, 'dashboard', 'ativa', 'sistema_base', 0),
    (p_empresa_id, 'configuracoes', 'ativa', 'sistema_base', 0),
    (p_empresa_id, 'usuarios', 'ativa', 'sistema_base', 0),
    (p_empresa_id, 'suporte', 'ativa', 'sistema_base', 0)
  ON CONFLICT (empresa_id, modulo_codigo) DO UPDATE
  SET
    status = 'ativa',
    ended_at = NULL,
    preco_centavos = COALESCE(public.empresa_modulos.preco_centavos, EXCLUDED.preco_centavos);
END;
$$;

CREATE OR REPLACE FUNCTION public.empresa_tem_modulo(
  p_empresa_id uuid,
  p_modulo_codigo text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresa_modulos em
    JOIN public.modulos_globais mg ON mg.codigo = em.modulo_codigo
    WHERE em.empresa_id = p_empresa_id
      AND em.modulo_codigo = p_modulo_codigo
      AND em.status = 'ativa'
      AND mg.ativo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_empresa_modulos_ativos(
  p_empresa_id uuid DEFAULT NULL
)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(em.modulo_codigo ORDER BY mg.ordem, em.modulo_codigo), ARRAY[]::text[])
  FROM public.empresa_modulos em
  JOIN public.modulos_globais mg ON mg.codigo = em.modulo_codigo
  WHERE em.empresa_id = COALESCE(p_empresa_id, public.minha_empresa_id())
    AND em.status = 'ativa'
    AND mg.ativo = true;
$$;

CREATE OR REPLACE FUNCTION public.get_empresa_modulos_detalhes(
  p_empresa_id uuid DEFAULT NULL
)
RETURNS TABLE (
  codigo text,
  nome text,
  descricao text,
  categoria text,
  preco_centavos bigint,
  ativo_global boolean,
  venda_ativa boolean,
  ativo_empresa boolean,
  origem text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    mg.codigo,
    mg.nome,
    mg.descricao,
    mg.categoria,
    COALESCE(em.preco_centavos, mg.preco_centavos) AS preco_centavos,
    mg.ativo AS ativo_global,
    mg.venda_ativa,
    (em.id IS NOT NULL AND em.status = 'ativa') AS ativo_empresa,
    em.origem
  FROM public.modulos_globais mg
  LEFT JOIN public.empresa_modulos em
    ON em.modulo_codigo = mg.codigo
   AND em.empresa_id = COALESCE(p_empresa_id, public.minha_empresa_id())
   AND em.status = 'ativa'
  ORDER BY mg.ordem, mg.nome;
$$;

CREATE OR REPLACE FUNCTION public.get_assinatura_valor_atual(
  p_empresa_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := COALESCE(p_empresa_id, public.minha_empresa_id());
  v_ass record;
  v_total_modulos bigint := 0;
  v_total_ativos int := 0;
  v_total_precificacao_real int := 0;
  v_total_legacy bigint := 0;
BEGIN
  IF v_empresa_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT a.id, a.plano_id, a.billing_model, p.valor_centavos
    INTO v_ass
  FROM public.assinaturas a
  LEFT JOIN public.planos p ON p.id = a.plano_id
  WHERE a.empresa_id = v_empresa_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  SELECT
    COALESCE(SUM(COALESCE(em.preco_centavos, mg.preco_centavos)), 0),
    COUNT(*) FILTER (WHERE em.status = 'ativa'),
    COUNT(*) FILTER (
      WHERE em.status = 'ativa'
        AND (
          em.preco_centavos IS NOT NULL
          OR em.origem NOT IN ('migracao_plano', 'sistema_base')
        )
    )
  INTO v_total_modulos, v_total_ativos, v_total_precificacao_real
  FROM public.empresa_modulos em
  JOIN public.modulos_globais mg ON mg.codigo = em.modulo_codigo
  WHERE em.empresa_id = v_empresa_id
    AND em.status = 'ativa'
    AND mg.ativo = true;

  v_total_legacy := COALESCE(v_ass.valor_centavos, 0);

  IF v_total_ativos = 0 THEN
    RETURN v_total_legacy;
  END IF;

  IF COALESCE(v_ass.billing_model, 'plano') = 'modular' THEN
    IF v_total_precificacao_real > 0 OR v_ass.plano_id IS NULL THEN
      RETURN v_total_modulos;
    END IF;
  END IF;

  RETURN v_total_legacy;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_module_catalog()
RETURNS TABLE (
  codigo text,
  nome text,
  descricao text,
  categoria text,
  preco_centavos bigint,
  ativo_global boolean,
  venda_ativa boolean,
  ativo_empresa boolean,
  base_obrigatoria boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    d.codigo,
    d.nome,
    d.descricao,
    d.categoria,
    d.preco_centavos,
    d.ativo_global,
    d.venda_ativa,
    d.ativo_empresa,
    (d.codigo IN ('dashboard', 'configuracoes', 'usuarios', 'suporte')) AS base_obrigatoria
  FROM public.get_empresa_modulos_detalhes(public.minha_empresa_id()) d;
$$;

CREATE OR REPLACE FUNCTION public.toggle_my_module_subscription(
  p_modulo_codigo text,
  p_ativo boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_assinatura_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF p_modulo_codigo IN ('dashboard', 'configuracoes', 'usuarios', 'suporte') AND NOT p_ativo THEN
    RAISE EXCEPTION 'modulo_base_cannot_disable';
  END IF;

  IF p_ativo THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.modulos_globais
      WHERE codigo = p_modulo_codigo
        AND ativo = true
        AND venda_ativa = true
    ) THEN
      RAISE EXCEPTION 'modulo_not_available';
    END IF;

    INSERT INTO public.empresa_modulos (empresa_id, modulo_codigo, status, origem, ended_at)
    VALUES (v_empresa_id, p_modulo_codigo, 'ativa', 'manual', NULL)
    ON CONFLICT (empresa_id, modulo_codigo) DO UPDATE
    SET
      status = 'ativa',
      origem = 'manual',
      ended_at = NULL,
      updated_at = now();
  ELSE
    UPDATE public.empresa_modulos
    SET
      status = 'cancelada',
      origem = 'manual',
      ended_at = now(),
      updated_at = now()
    WHERE empresa_id = v_empresa_id
      AND modulo_codigo = p_modulo_codigo
      AND status = 'ativa';
  END IF;

  SELECT id INTO v_assinatura_id
  FROM public.assinaturas
  WHERE empresa_id = v_empresa_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_assinatura_id IS NOT NULL THEN
    UPDATE public.assinaturas
    SET billing_model = 'modular', updated_at = now()
    WHERE id = v_assinatura_id;
  END IF;

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. MIGRAÇÃO INICIAL: EMPRESAS EXISTENTES
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.empresas LOOP
    PERFORM public.seed_empresa_modulos_base(r.id);
  END LOOP;
END
$$;

INSERT INTO public.empresa_modulos (empresa_id, modulo_codigo, status, origem)
SELECT DISTINCT
  a.empresa_id,
  m.modulo,
  'ativa',
  'migracao_plano'
FROM (
  SELECT DISTINCT ON (ax.empresa_id)
    ax.empresa_id,
    ax.plano_id,
    ax.id,
    ax.created_at
  FROM public.assinaturas ax
  ORDER BY ax.empresa_id, ax.created_at DESC
) a
JOIN public.planos p ON p.id = a.plano_id
JOIN LATERAL jsonb_array_elements_text(COALESCE(p.modulos, '[]'::jsonb)) AS m(modulo) ON true
WHERE EXISTS (SELECT 1 FROM public.modulos_globais mg WHERE mg.codigo = m.modulo)
ON CONFLICT (empresa_id, modulo_codigo) DO NOTHING;

UPDATE public.assinaturas
SET billing_model = 'modular'
WHERE billing_model IS DISTINCT FROM 'modular';

-- -----------------------------------------------------------------------------
-- 6. NOVAS EMPRESAS RECEBEM MÓDULOS BASE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_empresa_modulos_base()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_empresa_modulos_base(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_seed_modulos_base ON public.empresas;
CREATE TRIGGER trg_empresas_seed_modulos_base
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.ensure_empresa_modulos_base();

-- -----------------------------------------------------------------------------
-- 7. BILLING ATUALIZADO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_billing_current()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e uuid := public.minha_empresa_id();
  assin record;
  fat record;
  v_modulos text[];
  v_modulos_json jsonb;
  v_total_centavos bigint := 0;
BEGIN
  IF e IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT a.id, a.status, a.trial_ate, a.proxima_cobranca, a.plano_id, a.billing_model, p.nome AS plano_nome
    INTO assin
    FROM public.assinaturas a
    LEFT JOIN public.planos p ON p.id = a.plano_id
   WHERE a.empresa_id = e
   ORDER BY a.created_at DESC
   LIMIT 1;

  SELECT id, valor_centavos, status AS fatura_status, vencimento, pix_qr_code, pix_copia_cola
    INTO fat
    FROM public.faturas
   WHERE empresa_id = e AND status = 'aberta'
   ORDER BY created_at DESC
   LIMIT 1;

  v_modulos := public.get_empresa_modulos_ativos(e);
  v_total_centavos := public.get_assinatura_valor_atual(e);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'codigo', d.codigo,
    'nome', d.nome,
    'descricao', d.descricao,
    'categoria', d.categoria,
    'preco_centavos', d.preco_centavos,
    'ativo_empresa', d.ativo_empresa
  ) ORDER BY d.categoria, d.nome), '[]'::jsonb)
  INTO v_modulos_json
  FROM public.get_empresa_modulos_detalhes(e) d
  WHERE d.ativo_empresa = true;

  RETURN jsonb_build_object(
    'empresa_id', e,
    'status', assin.status,
    'trial_ate', assin.trial_ate,
    'proxima_cobranca', assin.proxima_cobranca,
    'plano_id', assin.plano_id,
    'plano_nome', assin.plano_nome,
    'billing_model', COALESCE(assin.billing_model, 'plano'),
    'valor_total_centavos', v_total_centavos,
    'modulos_ativos', COALESCE(to_jsonb(v_modulos), '[]'::jsonb),
    'modulos_detalhes', COALESCE(v_modulos_json, '[]'::jsonb),
    'fatura_id', COALESCE(fat.id, NULL),
    'valor_centavos', COALESCE(fat.valor_centavos, v_total_centavos),
    'fatura_status', COALESCE(fat.fatura_status, NULL),
    'vencimento', COALESCE(fat.vencimento, NULL),
    'pix_qr_code', COALESCE(fat.pix_qr_code, NULL),
    'pix_copia_cola', COALESCE(fat.pix_copia_cola, NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_my_manual_invoice()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_assinatura record;
  v_fatura_existente uuid;
  v_fatura_id uuid;
  v_valor bigint;
  v_vencimento date;
  v_grace_days int := COALESCE((public.get_billing_policy()->>'grace_days')::int, 5);
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT a.id, a.proxima_cobranca
    INTO v_assinatura
    FROM public.assinaturas a
   WHERE a.empresa_id = v_empresa_id
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF v_assinatura.id IS NULL THEN
    RAISE EXCEPTION 'assinatura_not_found';
  END IF;

  v_valor := public.get_assinatura_valor_atual(v_empresa_id);
  v_vencimento := COALESCE(v_assinatura.proxima_cobranca, (current_date + GREATEST(v_grace_days, 0)));

  SELECT f.id INTO v_fatura_existente
    FROM public.faturas f
   WHERE f.empresa_id = v_empresa_id
     AND f.assinatura_id = v_assinatura.id
     AND f.status = 'aberta'
     AND f.vencimento = v_vencimento
   LIMIT 1;

  IF v_fatura_existente IS NOT NULL THEN
    RETURN v_fatura_existente;
  END IF;

  INSERT INTO public.faturas (
    empresa_id,
    assinatura_id,
    valor_centavos,
    status,
    vencimento
  ) VALUES (
    v_empresa_id,
    v_assinatura.id,
    v_valor,
    'aberta',
    v_vencimento
  )
  RETURNING id INTO v_fatura_id;

  RETURN v_fatura_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPCS MASTER PARA CATÁLOGO COMERCIAL E EMPRESA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.master_list_modulos_catalogo()
RETURNS TABLE (
  codigo text,
  nome text,
  descricao text,
  categoria text,
  preco_centavos bigint,
  ordem int,
  ativo boolean,
  venda_ativa boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT mg.codigo, mg.nome, mg.descricao, mg.categoria, mg.preco_centavos, mg.ordem, mg.ativo, mg.venda_ativa
  FROM public.modulos_globais mg
  ORDER BY mg.ordem, mg.nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_save_modulo_catalogo(
  p_codigo text,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_categoria text DEFAULT 'operacional',
  p_preco_centavos bigint DEFAULT 0,
  p_ordem int DEFAULT 0,
  p_ativo boolean DEFAULT true,
  p_venda_ativa boolean DEFAULT true
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_codigo IS NULL OR btrim(p_codigo) = '' THEN
    RAISE EXCEPTION 'codigo_required';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'nome_required';
  END IF;

  INSERT INTO public.modulos_globais (
    codigo, nome, descricao, categoria, preco_centavos, ordem, ativo, venda_ativa
  ) VALUES (
    btrim(lower(p_codigo)),
    btrim(p_nome),
    NULLIF(btrim(p_descricao), ''),
    COALESCE(NULLIF(btrim(p_categoria), ''), 'operacional'),
    COALESCE(p_preco_centavos, 0),
    COALESCE(p_ordem, 0),
    COALESCE(p_ativo, true),
    COALESCE(p_venda_ativa, true)
  )
  ON CONFLICT (codigo) DO UPDATE
  SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    categoria = EXCLUDED.categoria,
    preco_centavos = EXCLUDED.preco_centavos,
    ordem = EXCLUDED.ordem,
    ativo = EXCLUDED.ativo,
    venda_ativa = EXCLUDED.venda_ativa,
    updated_at = now();

  RETURN btrim(lower(p_codigo));
END;
$$;

CREATE OR REPLACE FUNCTION public.master_set_empresa_modulos(
  p_empresa_id uuid,
  p_modulos text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mod text;
  v_assinatura_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  PERFORM public.seed_empresa_modulos_base(p_empresa_id);

  UPDATE public.empresa_modulos
  SET
    status = 'cancelada',
    ended_at = now(),
    updated_at = now(),
    origem = 'manual_master'
  WHERE empresa_id = p_empresa_id
    AND modulo_codigo NOT IN ('dashboard', 'configuracoes', 'usuarios', 'suporte')
    AND status = 'ativa'
    AND NOT (modulo_codigo = ANY(COALESCE(p_modulos, ARRAY[]::text[])));

  FOREACH v_mod IN ARRAY COALESCE(p_modulos, ARRAY[]::text[]) LOOP
    IF EXISTS (SELECT 1 FROM public.modulos_globais WHERE codigo = v_mod) THEN
      INSERT INTO public.empresa_modulos (empresa_id, modulo_codigo, status, origem, ended_at)
      VALUES (p_empresa_id, v_mod, 'ativa', 'manual_master', NULL)
      ON CONFLICT (empresa_id, modulo_codigo) DO UPDATE
      SET
        status = 'ativa',
        origem = 'manual_master',
        ended_at = NULL,
        updated_at = now();
    END IF;
  END LOOP;

  SELECT id INTO v_assinatura_id
  FROM public.assinaturas
  WHERE empresa_id = p_empresa_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_assinatura_id IS NOT NULL THEN
    UPDATE public.assinaturas
    SET billing_model = 'modular', updated_at = now()
    WHERE id = v_assinatura_id;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_billing_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_ativas int := 0;
  v_trial int := 0;
  v_bloqueadas int := 0;
  v_past_due int := 0;
  v_mrr bigint := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (a.empresa_id)
      a.empresa_id,
      a.status
    FROM public.assinaturas a
    ORDER BY a.empresa_id, a.created_at DESC
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'ativa'),
    COUNT(*) FILTER (WHERE status = 'trial'),
    COUNT(*) FILTER (WHERE status = 'bloqueada'),
    COUNT(*) FILTER (WHERE status = 'past_due')
  INTO v_total, v_ativas, v_trial, v_bloqueadas, v_past_due
  FROM latest;

  SELECT COALESCE(SUM(public.get_assinatura_valor_atual(e.id)), 0)
  INTO v_mrr
  FROM public.empresas e
  WHERE EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.empresa_id = e.id
      AND a.status = 'ativa'
  );

  RETURN jsonb_build_object(
    'total_empresas', v_total,
    'ativas', v_ativas,
    'trial', v_trial,
    'bloqueadas', v_bloqueadas,
    'past_due', v_past_due,
    'mrr_centavos', v_mrr,
    'inadimplencia_pct', CASE WHEN v_total > 0 THEN ROUND(((v_past_due + v_bloqueadas)::numeric / v_total::numeric) * 100) ELSE 0 END,
    'conversao_pct', CASE WHEN (v_ativas + v_trial) > 0 THEN ROUND((v_ativas::numeric / (v_ativas + v_trial)::numeric) * 100) ELSE 0 END
  );
END;
$$;

DROP FUNCTION IF EXISTS public.master_list_empresas();

CREATE OR REPLACE FUNCTION public.master_list_empresas()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  created_at timestamptz,
  status text,
  proxima_cobranca timestamptz,
  trial_ate timestamptz,
  modulos_ativos text[],
  total_modulos int,
  valor_mensal_centavos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.nome,
    e.email,
    e.created_at,
    a.status,
    a.proxima_cobranca,
    a.trial_ate,
    COALESCE(public.get_empresa_modulos_ativos(e.id), ARRAY[]::text[]) AS modulos_ativos,
    COALESCE(array_length(public.get_empresa_modulos_ativos(e.id), 1), 0) AS total_modulos,
    public.get_assinatura_valor_atual(e.id) AS valor_mensal_centavos
  FROM public.empresas e
  LEFT JOIN LATERAL (
    SELECT ax.*
    FROM public.assinaturas ax
    WHERE ax.empresa_id = e.id
    ORDER BY ax.created_at DESC
    LIMIT 1
  ) a ON true
  ORDER BY e.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_get_empresa_editor(
  p_empresa_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa jsonb;
  v_assinatura jsonb;
  v_catalogo jsonb;
  v_modulos text[];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT to_jsonb(e)
  INTO v_empresa
  FROM public.empresas e
  WHERE e.id = p_empresa_id;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT to_jsonb(a)
  INTO v_assinatura
  FROM public.assinaturas a
  WHERE a.empresa_id = p_empresa_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'codigo', mg.codigo,
    'nome', mg.nome,
    'descricao', mg.descricao,
    'categoria', mg.categoria,
    'preco_centavos', mg.preco_centavos,
    'ordem', mg.ordem,
    'ativo', mg.ativo,
    'venda_ativa', mg.venda_ativa
  ) ORDER BY mg.ordem, mg.nome), '[]'::jsonb)
  INTO v_catalogo
  FROM public.modulos_globais mg;

  v_modulos := public.get_empresa_modulos_ativos(p_empresa_id);

  RETURN jsonb_build_object(
    'empresa', v_empresa,
    'assinatura', COALESCE(v_assinatura, '{}'::jsonb),
    'modulos_catalogo', COALESCE(v_catalogo, '[]'::jsonb),
    'empresa_modulos', COALESCE(to_jsonb(v_modulos), '[]'::jsonb)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.master_save_empresa_editor(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  uuid
);

CREATE OR REPLACE FUNCTION public.master_save_empresa_editor(
  p_empresa_id uuid,
  p_nome text,
  p_email text DEFAULT NULL,
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_endereco text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_trial_ate timestamptz DEFAULT NULL,
  p_proxima_cobranca timestamptz DEFAULT NULL,
  p_plano_id uuid DEFAULT NULL,
  p_modulos text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assinatura_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = p_empresa_id) THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  UPDATE public.empresas
  SET
    nome = p_nome,
    email = NULLIF(btrim(p_email), '')
  WHERE id = p_empresa_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'cnpj'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET cnpj = $1 WHERE id = $2'
      USING NULLIF(btrim(p_cnpj), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'telefone'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET telefone = $1 WHERE id = $2'
      USING NULLIF(btrim(p_telefone), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'endereco'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET endereco = $1 WHERE id = $2'
      USING NULLIF(btrim(p_endereco), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'cidade'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET cidade = $1 WHERE id = $2'
      USING NULLIF(btrim(p_cidade), ''), p_empresa_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'empresas' AND column_name = 'estado'
  ) THEN
    EXECUTE 'UPDATE public.empresas SET estado = $1 WHERE id = $2'
      USING NULLIF(btrim(p_estado), ''), p_empresa_id;
  END IF;

  SELECT a.id
  INTO v_assinatura_id
  FROM public.assinaturas a
  WHERE a.empresa_id = p_empresa_id
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_assinatura_id IS NULL THEN
    INSERT INTO public.assinaturas (
      empresa_id,
      plano_id,
      status,
      trial_ate,
      proxima_cobranca,
      billing_model
    ) VALUES (
      p_empresa_id,
      p_plano_id,
      COALESCE(p_status, 'trial'),
      p_trial_ate,
      p_proxima_cobranca,
      'modular'
    );
  ELSE
    UPDATE public.assinaturas
    SET
      status = COALESCE(p_status, status),
      trial_ate = p_trial_ate,
      proxima_cobranca = p_proxima_cobranca,
      plano_id = p_plano_id,
      billing_model = 'modular',
      updated_at = now()
    WHERE id = v_assinatura_id;
  END IF;

  PERFORM public.master_set_empresa_modulos(p_empresa_id, COALESCE(p_modulos, ARRAY[]::text[]));

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.seed_empresa_modulos_base(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.empresa_tem_modulo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_modulos_ativos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_modulos_detalhes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assinatura_valor_atual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_module_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_my_module_subscription(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_modulos_catalogo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_save_modulo_catalogo(text, text, text, text, bigint, int, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_set_empresa_modulos(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_billing_overview() TO authenticated;
