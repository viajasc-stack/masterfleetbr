-- =============================================================================
-- Unificação final da base do sistema em "operacional"
-- =============================================================================

-- Códigos legados absorvidos pelo pacote operacional
-- (inclui os antigos módulos-base administrativos)

UPDATE public.modulos_globais
SET
  ativo = false,
  venda_ativa = false,
  categoria = 'legacy',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'legacy', true,
    'merged_into', 'operacional'
  ),
  updated_at = now()
WHERE codigo IN (
  'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
  'configuracoes', 'usuarios', 'suporte', 'relatorios'
);

UPDATE public.modulos_globais
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'default_module', true,
    'bundle_of', jsonb_build_array(
      'dashboard',
      'ordens_servico',
      'clientes',
      'veiculos',
      'motoristas',
      'configuracoes',
      'usuarios',
      'suporte',
      'relatorios'
    )
  ),
  updated_at = now()
WHERE codigo = 'operacional';

CREATE OR REPLACE FUNCTION public.seed_empresa_modulos_base(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.empresa_modulos (empresa_id, modulo_codigo, status, origem, preco_centavos)
  VALUES
    (p_empresa_id, 'operacional', 'ativa', 'sistema_base', NULL)
  ON CONFLICT (empresa_id, modulo_codigo) DO UPDATE
  SET
    status = 'ativa',
    ended_at = NULL,
    preco_centavos = COALESCE(public.empresa_modulos.preco_centavos, EXCLUDED.preco_centavos),
    updated_at = now();
END;
$$;

UPDATE public.empresa_modulos
SET
  status = 'cancelada',
  ended_at = COALESCE(ended_at, now()),
  origem = 'migracao_operacional_base',
  updated_at = now()
WHERE modulo_codigo IN (
  'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
  'configuracoes', 'usuarios', 'suporte', 'relatorios'
)
  AND status = 'ativa';

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
    AND mg.ativo = true
    AND mg.codigo NOT IN (
      'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
      'configuracoes', 'usuarios', 'suporte', 'relatorios'
    );
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
  WHERE mg.codigo NOT IN (
    'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
    'configuracoes', 'usuarios', 'suporte', 'relatorios'
  )
  ORDER BY mg.ordem, mg.nome;
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
    (d.codigo = 'operacional') AS base_obrigatoria
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

  IF p_modulo_codigo IN (
    'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
    'configuracoes', 'usuarios', 'suporte', 'relatorios'
  ) THEN
    RAISE EXCEPTION 'legacy_module_not_available';
  END IF;

  IF p_modulo_codigo = 'operacional' AND NOT p_ativo THEN
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
  WHERE mg.codigo NOT IN (
    'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
    'configuracoes', 'usuarios', 'suporte', 'relatorios'
  )
  ORDER BY mg.ordem, mg.nome;
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
    AND modulo_codigo <> 'operacional'
    AND status = 'ativa'
    AND NOT (modulo_codigo = ANY(COALESCE(p_modulos, ARRAY[]::text[])));

  FOREACH v_mod IN ARRAY COALESCE(p_modulos, ARRAY[]::text[]) LOOP
    IF v_mod IN (
      'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
      'configuracoes', 'usuarios', 'suporte', 'relatorios'
    ) THEN
      v_mod := 'operacional';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.modulos_globais
      WHERE codigo = v_mod
        AND codigo NOT IN (
          'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
          'configuracoes', 'usuarios', 'suporte', 'relatorios'
        )
    ) THEN
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
  WHERE m.codigo NOT IN (
    'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
    'configuracoes', 'usuarios', 'suporte', 'relatorios'
  )
  ORDER BY m.ordem, m.codigo;
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
  FROM public.modulos_globais mg
  WHERE mg.codigo NOT IN (
    'dashboard', 'ordens_servico', 'clientes', 'veiculos', 'motoristas',
    'configuracoes', 'usuarios', 'suporte', 'relatorios'
  );

  v_modulos := public.get_empresa_modulos_ativos(p_empresa_id);

  RETURN jsonb_build_object(
    'empresa', v_empresa,
    'assinatura', COALESCE(v_assinatura, '{}'::jsonb),
    'modulos_catalogo', COALESCE(v_catalogo, '[]'::jsonb),
    'empresa_modulos', COALESCE(to_jsonb(v_modulos), '[]'::jsonb)
  );
END;
$$;
