-- Controle global de módulos (override master)

CREATE TABLE IF NOT EXISTS public.modulos_globais (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  descricao text NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_modulos_globais_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_modulos_globais_updated_at ON public.modulos_globais;
CREATE TRIGGER trg_modulos_globais_updated_at
BEFORE UPDATE ON public.modulos_globais
FOR EACH ROW EXECUTE FUNCTION public.set_modulos_globais_updated_at();

INSERT INTO public.modulos_globais (codigo, nome, descricao, ativo)
VALUES
  ('dashboard', 'Dashboard', 'Visão geral operacional', true),
  ('ordens_servico', 'Ordens de serviço', 'OS, orçamentos, contratos e fretamentos', true),
  ('clientes', 'Clientes', 'Cadastros e relacionamento de clientes', true),
  ('veiculos', 'Veículos', 'Gestão de frota e dados dos veículos', true),
  ('motoristas', 'Motoristas', 'Cadastros e operação de motoristas', true),
  ('inventario', 'Inventário', 'Estoque, entradas, saídas e compras', true),
  ('financeiro', 'Financeiro', 'Contas, faturas e cobrança', true),
  ('manutencao', 'Manutenção', 'Planos, ordens e custos de manutenção', true),
  ('agenda', 'Agenda', 'Agenda operacional e integrações calendário', true),
  ('viagens', 'Viagens', 'Gestão de viagens e pedidos', true),
  ('relatorios', 'Relatórios', 'Relatórios, BI, telemetria e observabilidade', true),
  ('suporte', 'Suporte', 'Atendimento e comunicação de suporte', true),
  ('usuarios', 'Usuários', 'Gestão de usuários da empresa', true),
  ('configuracoes', 'Configurações', 'Configurações gerais e integrações', true)
ON CONFLICT (codigo) DO UPDATE
SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao;

ALTER TABLE public.modulos_globais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modulos_globais_master_select ON public.modulos_globais;
CREATE POLICY modulos_globais_master_select
ON public.modulos_globais
FOR SELECT
USING (public.is_super_admin());

DROP POLICY IF EXISTS modulos_globais_master_update ON public.modulos_globais;
CREATE POLICY modulos_globais_master_update
ON public.modulos_globais
FOR UPDATE
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.master_list_modulos_globais()
RETURNS TABLE (
  codigo text,
  nome text,
  descricao text,
  ativo boolean,
  updated_at timestamptz
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
  SELECT m.codigo, m.nome, m.descricao, m.ativo, m.updated_at
  FROM public.modulos_globais m
  ORDER BY m.codigo;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_set_modulo_global(
  p_codigo text,
  p_ativo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.modulos_globais
  SET ativo = p_ativo
  WHERE codigo = p_codigo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'modulo_not_found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_modulos_globais_ativos()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(array_agg(codigo ORDER BY codigo), ARRAY[]::text[])
  FROM public.modulos_globais
  WHERE ativo = true;
$$;

GRANT EXECUTE ON FUNCTION public.master_list_modulos_globais() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_set_modulo_global(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_modulos_globais_ativos() TO authenticated;
