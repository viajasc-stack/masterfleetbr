-- =============================================================================
-- Central de Negócios (MVP)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'negocio_tipo_oportunidade') THEN
    CREATE TYPE public.negocio_tipo_oportunidade AS ENUM (
      'venda',
      'compra',
      'permuta',
      'procura_parceiro',
      'prestacao_servico'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'negocio_status_anuncio') THEN
    CREATE TYPE public.negocio_status_anuncio AS ENUM (
      'rascunho',
      'ativo',
      'aguardando_confirmacao',
      'pausado',
      'inativo',
      'vendido',
      'removido'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'negocio_canal_contato') THEN
    CREATE TYPE public.negocio_canal_contato AS ENUM ('whatsapp', 'telefone', 'email');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'negocio_motivo_denuncia') THEN
    CREATE TYPE public.negocio_motivo_denuncia AS ENUM (
      'fora_do_segmento',
      'conteudo_invalido',
      'ja_vendido',
      'spam',
      'outro'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'negocio_resposta_confirmacao') THEN
    CREATE TYPE public.negocio_resposta_confirmacao AS ENUM ('ainda_disponivel', 'vendido', 'pausar');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_empresa_assinatura_ativa_sem_trial(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.empresa_id = p_empresa_id
      AND a.status = 'ativa'
      AND (a.trial_ate IS NULL OR a.trial_ate < now())
  );
$$;

CREATE OR REPLACE FUNCTION public.set_negocio_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.negocio_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  descricao text,
  ativa boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.negocio_subcategorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES public.negocio_categorias(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (categoria_id, slug)
);

CREATE TABLE IF NOT EXISTS public.negocio_anuncios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,

  tipo_oportunidade public.negocio_tipo_oportunidade NOT NULL,
  categoria_id uuid NOT NULL REFERENCES public.negocio_categorias(id) ON DELETE RESTRICT,
  subcategoria_id uuid REFERENCES public.negocio_subcategorias(id) ON DELETE RESTRICT,

  titulo text NOT NULL,
  descricao text NOT NULL,
  preco_centavos bigint,
  preco_a_combinar boolean NOT NULL DEFAULT false,

  cidade text NOT NULL,
  estado text NOT NULL,

  status public.negocio_status_anuncio NOT NULL DEFAULT 'rascunho',
  publicado_em timestamptz,

  proxima_confirmacao_em timestamptz,
  confirmacao_solicitada_em timestamptz,
  limite_resposta_em timestamptz,
  ultima_confirmacao_em timestamptz,

  removido_motivo text,
  removido_por uuid REFERENCES auth.users(id),
  removido_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT negocio_preco_regra CHECK (
    (preco_a_combinar = true AND preco_centavos IS NULL)
    OR
    (preco_a_combinar = false AND preco_centavos IS NOT NULL AND preco_centavos >= 0)
  )
);

CREATE TABLE IF NOT EXISTS public.negocio_anuncio_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.negocio_anuncios(id) ON DELETE CASCADE,
  canal public.negocio_canal_contato NOT NULL,
  valor text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anuncio_id, canal)
);

CREATE TABLE IF NOT EXISTS public.negocio_anuncio_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.negocio_anuncios(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.negocio_favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  anuncio_id uuid NOT NULL REFERENCES public.negocio_anuncios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, anuncio_id)
);

CREATE TABLE IF NOT EXISTS public.negocio_denuncias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.negocio_anuncios(id) ON DELETE CASCADE,
  denunciante_empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  denunciante_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  motivo public.negocio_motivo_denuncia NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_analise','resolvida','arquivada')),
  tratada_por uuid REFERENCES auth.users(id),
  tratada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anuncio_id, denunciante_empresa_id, motivo)
);

CREATE TABLE IF NOT EXISTS public.negocio_confirmacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.negocio_anuncios(id) ON DELETE CASCADE,
  solicitada_em timestamptz NOT NULL,
  limite_resposta_em timestamptz NOT NULL,
  respondida_em timestamptz,
  resposta public.negocio_resposta_confirmacao,
  origem text NOT NULL DEFAULT 'scheduler',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negocio_anuncios_listagem
  ON public.negocio_anuncios (status, tipo_oportunidade, categoria_id, estado, cidade, publicado_em DESC);

CREATE INDEX IF NOT EXISTS idx_negocio_anuncios_empresa
  ON public.negocio_anuncios (empresa_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_negocio_confirmacoes_abertas
  ON public.negocio_confirmacoes_log (anuncio_id, solicitada_em DESC)
  WHERE respondida_em IS NULL;

DROP TRIGGER IF EXISTS trg_negocio_categorias_updated_at ON public.negocio_categorias;
CREATE TRIGGER trg_negocio_categorias_updated_at
BEFORE UPDATE ON public.negocio_categorias
FOR EACH ROW EXECUTE FUNCTION public.set_negocio_updated_at();

DROP TRIGGER IF EXISTS trg_negocio_subcategorias_updated_at ON public.negocio_subcategorias;
CREATE TRIGGER trg_negocio_subcategorias_updated_at
BEFORE UPDATE ON public.negocio_subcategorias
FOR EACH ROW EXECUTE FUNCTION public.set_negocio_updated_at();

DROP TRIGGER IF EXISTS trg_negocio_anuncios_updated_at ON public.negocio_anuncios;
CREATE TRIGGER trg_negocio_anuncios_updated_at
BEFORE UPDATE ON public.negocio_anuncios
FOR EACH ROW EXECUTE FUNCTION public.set_negocio_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.negocio_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_subcategorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_anuncio_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_anuncio_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocio_confirmacoes_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS negocio_categorias_select ON public.negocio_categorias;
CREATE POLICY negocio_categorias_select
ON public.negocio_categorias
FOR SELECT
TO authenticated
USING (ativa = true OR public.is_super_admin());

DROP POLICY IF EXISTS negocio_categorias_master_write ON public.negocio_categorias;
CREATE POLICY negocio_categorias_master_write
ON public.negocio_categorias
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS negocio_subcategorias_select ON public.negocio_subcategorias;
CREATE POLICY negocio_subcategorias_select
ON public.negocio_subcategorias
FOR SELECT
TO authenticated
USING (
  ativa = true
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.negocio_categorias c
    WHERE c.id = categoria_id
      AND (c.ativa = true OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS negocio_subcategorias_master_write ON public.negocio_subcategorias;
CREATE POLICY negocio_subcategorias_master_write
ON public.negocio_subcategorias
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS negocio_anuncios_select_publico_auth ON public.negocio_anuncios;
CREATE POLICY negocio_anuncios_select_publico_auth
ON public.negocio_anuncios
FOR SELECT
TO authenticated
USING (
  status = 'ativo'
  OR empresa_id = public.minha_empresa_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS negocio_anuncios_insert_own ON public.negocio_anuncios;
CREATE POLICY negocio_anuncios_insert_own
ON public.negocio_anuncios
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id = public.minha_empresa_id()
  AND (
    status = 'rascunho'
    OR public.is_empresa_assinatura_ativa_sem_trial(empresa_id)
  )
);

DROP POLICY IF EXISTS negocio_anuncios_update_own_or_master ON public.negocio_anuncios;
CREATE POLICY negocio_anuncios_update_own_or_master
ON public.negocio_anuncios
FOR UPDATE
TO authenticated
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())
WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS negocio_anuncios_delete_master ON public.negocio_anuncios;
CREATE POLICY negocio_anuncios_delete_master
ON public.negocio_anuncios
FOR DELETE
TO authenticated
USING (public.is_super_admin());

DROP POLICY IF EXISTS negocio_anuncio_contatos_select ON public.negocio_anuncio_contatos;
CREATE POLICY negocio_anuncio_contatos_select
ON public.negocio_anuncio_contatos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.negocio_anuncios a
    WHERE a.id = anuncio_id
      AND (
        a.status = 'ativo'
        OR a.empresa_id = public.minha_empresa_id()
        OR public.is_super_admin()
      )
  )
);

DROP POLICY IF EXISTS negocio_anuncio_contatos_write ON public.negocio_anuncio_contatos;
CREATE POLICY negocio_anuncio_contatos_write
ON public.negocio_anuncio_contatos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.negocio_anuncios a
    WHERE a.id = anuncio_id
      AND (a.empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.negocio_anuncios a
    WHERE a.id = anuncio_id
      AND (a.empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS negocio_anuncio_imagens_select ON public.negocio_anuncio_imagens;
CREATE POLICY negocio_anuncio_imagens_select
ON public.negocio_anuncio_imagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.negocio_anuncios a
    WHERE a.id = anuncio_id
      AND (
        a.status = 'ativo'
        OR a.empresa_id = public.minha_empresa_id()
        OR public.is_super_admin()
      )
  )
);

DROP POLICY IF EXISTS negocio_anuncio_imagens_write ON public.negocio_anuncio_imagens;
CREATE POLICY negocio_anuncio_imagens_write
ON public.negocio_anuncio_imagens
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.negocio_anuncios a
    WHERE a.id = anuncio_id
      AND (a.empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.negocio_anuncios a
    WHERE a.id = anuncio_id
      AND (a.empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS negocio_favoritos_select_own ON public.negocio_favoritos;
CREATE POLICY negocio_favoritos_select_own
ON public.negocio_favoritos
FOR SELECT
TO authenticated
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS negocio_favoritos_insert_own ON public.negocio_favoritos;
CREATE POLICY negocio_favoritos_insert_own
ON public.negocio_favoritos
FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS negocio_favoritos_delete_own ON public.negocio_favoritos;
CREATE POLICY negocio_favoritos_delete_own
ON public.negocio_favoritos
FOR DELETE
TO authenticated
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS negocio_denuncias_select ON public.negocio_denuncias;
CREATE POLICY negocio_denuncias_select
ON public.negocio_denuncias
FOR SELECT
TO authenticated
USING (
  denunciante_empresa_id = public.minha_empresa_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS negocio_denuncias_insert_own ON public.negocio_denuncias;
CREATE POLICY negocio_denuncias_insert_own
ON public.negocio_denuncias
FOR INSERT
TO authenticated
WITH CHECK (
  denunciante_empresa_id = public.minha_empresa_id()
  AND denunciante_user_id = auth.uid()
);

DROP POLICY IF EXISTS negocio_denuncias_update_master ON public.negocio_denuncias;
CREATE POLICY negocio_denuncias_update_master
ON public.negocio_denuncias
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS negocio_confirmacoes_log_select ON public.negocio_confirmacoes_log;
CREATE POLICY negocio_confirmacoes_log_select
ON public.negocio_confirmacoes_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.negocio_anuncios a
    WHERE a.id = anuncio_id
      AND (a.empresa_id = public.minha_empresa_id() OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS negocio_confirmacoes_log_master_write ON public.negocio_confirmacoes_log;
CREATE POLICY negocio_confirmacoes_log_master_write
ON public.negocio_confirmacoes_log
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.negocio_criar_anuncio(
  p_tipo public.negocio_tipo_oportunidade,
  p_categoria_id uuid,
  p_subcategoria_id uuid,
  p_titulo text,
  p_descricao text,
  p_preco_centavos bigint,
  p_preco_a_combinar boolean,
  p_cidade text,
  p_estado text,
  p_contatos jsonb,
  p_imagens jsonb,
  p_publicar boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_user_id uuid := auth.uid();
  v_anuncio_id uuid;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF p_publicar AND NOT public.is_empresa_assinatura_ativa_sem_trial(v_empresa_id) THEN
    RAISE EXCEPTION 'assinatura_nao_permite_publicacao';
  END IF;

  INSERT INTO public.negocio_anuncios (
    empresa_id, criado_por, tipo_oportunidade, categoria_id, subcategoria_id,
    titulo, descricao, preco_centavos, preco_a_combinar,
    cidade, estado, status, publicado_em, proxima_confirmacao_em
  ) VALUES (
    v_empresa_id, v_user_id, p_tipo, p_categoria_id, p_subcategoria_id,
    trim(p_titulo), trim(p_descricao), p_preco_centavos, p_preco_a_combinar,
    trim(p_cidade), upper(trim(p_estado)),
    CASE WHEN p_publicar THEN 'ativo' ELSE 'rascunho' END,
    CASE WHEN p_publicar THEN now() ELSE NULL END,
    CASE WHEN p_publicar THEN now() + interval '7 days' ELSE NULL END
  ) RETURNING id INTO v_anuncio_id;

  IF p_contatos IS NOT NULL AND jsonb_typeof(p_contatos) = 'array' THEN
    INSERT INTO public.negocio_anuncio_contatos (anuncio_id, canal, valor, ordem)
    SELECT
      v_anuncio_id,
      (elem->>'canal')::public.negocio_canal_contato,
      trim(elem->>'valor'),
      COALESCE((elem->>'ordem')::int, ord::int)
    FROM jsonb_array_elements(p_contatos) WITH ORDINALITY AS t(elem, ord)
    WHERE COALESCE(trim(elem->>'valor'), '') <> '';
  END IF;

  IF p_imagens IS NOT NULL AND jsonb_typeof(p_imagens) = 'array' THEN
    INSERT INTO public.negocio_anuncio_imagens (anuncio_id, storage_path, ordem)
    SELECT
      v_anuncio_id,
      trim(
        CASE
          WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
          ELSE elem->>'storage_path'
        END
      ) AS storage_path,
      COALESCE((elem->>'ordem')::int, ord::int)
    FROM jsonb_array_elements(p_imagens) WITH ORDINALITY AS t(elem, ord)
    WHERE COALESCE(trim(
      CASE
        WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
        ELSE elem->>'storage_path'
      END
    ), '') <> '';
  END IF;

  RETURN v_anuncio_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.negocio_editar_anuncio(
  p_anuncio_id uuid,
  p_tipo public.negocio_tipo_oportunidade,
  p_categoria_id uuid,
  p_subcategoria_id uuid,
  p_titulo text,
  p_descricao text,
  p_preco_centavos bigint,
  p_preco_a_combinar boolean,
  p_cidade text,
  p_estado text,
  p_contatos jsonb DEFAULT NULL,
  p_imagens jsonb DEFAULT NULL,
  p_publicar boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_anuncio public.negocio_anuncios;
  v_pode_publicar boolean := false;
BEGIN
  SELECT * INTO v_anuncio
  FROM public.negocio_anuncios
  WHERE id = p_anuncio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'anuncio_not_found';
  END IF;

  IF NOT public.is_super_admin() AND v_anuncio.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_pode_publicar := p_publicar
    AND v_anuncio.status = 'rascunho'
    AND public.is_empresa_assinatura_ativa_sem_trial(v_anuncio.empresa_id);

  UPDATE public.negocio_anuncios
  SET
    tipo_oportunidade = p_tipo,
    categoria_id = p_categoria_id,
    subcategoria_id = p_subcategoria_id,
    titulo = trim(p_titulo),
    descricao = trim(p_descricao),
    preco_centavos = p_preco_centavos,
    preco_a_combinar = p_preco_a_combinar,
    cidade = trim(p_cidade),
    estado = upper(trim(p_estado)),
    status = CASE WHEN v_pode_publicar THEN 'ativo' ELSE status END,
    publicado_em = CASE WHEN v_pode_publicar AND publicado_em IS NULL THEN now() ELSE publicado_em END,
    proxima_confirmacao_em = CASE WHEN v_pode_publicar THEN now() + interval '7 days' ELSE proxima_confirmacao_em END,
    updated_at = now()
  WHERE id = p_anuncio_id;

  IF p_contatos IS NOT NULL THEN
    DELETE FROM public.negocio_anuncio_contatos WHERE anuncio_id = p_anuncio_id;
    IF jsonb_typeof(p_contatos) = 'array' THEN
      INSERT INTO public.negocio_anuncio_contatos (anuncio_id, canal, valor, ordem)
      SELECT
        p_anuncio_id,
        (elem->>'canal')::public.negocio_canal_contato,
        trim(elem->>'valor'),
        COALESCE((elem->>'ordem')::int, ord::int)
      FROM jsonb_array_elements(p_contatos) WITH ORDINALITY AS t(elem, ord)
      WHERE COALESCE(trim(elem->>'valor'), '') <> '';
    END IF;
  END IF;

  IF p_imagens IS NOT NULL THEN
    DELETE FROM public.negocio_anuncio_imagens WHERE anuncio_id = p_anuncio_id;
    IF jsonb_typeof(p_imagens) = 'array' THEN
      INSERT INTO public.negocio_anuncio_imagens (anuncio_id, storage_path, ordem)
      SELECT
        p_anuncio_id,
        trim(
          CASE
            WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
            ELSE elem->>'storage_path'
          END
        ),
        COALESCE((elem->>'ordem')::int, ord::int)
      FROM jsonb_array_elements(p_imagens) WITH ORDINALITY AS t(elem, ord)
      WHERE COALESCE(trim(
        CASE
          WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
          ELSE elem->>'storage_path'
        END
      ), '') <> '';
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.negocio_atualizar_status_anuncio(
  p_anuncio_id uuid,
  p_status public.negocio_status_anuncio,
  p_motivo text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  UPDATE public.negocio_anuncios
  SET
    status = p_status,
    removido_motivo = CASE WHEN p_status = 'removido' THEN p_motivo ELSE removido_motivo END,
    removido_por = CASE WHEN p_status = 'removido' THEN auth.uid() ELSE removido_por END,
    removido_em = CASE WHEN p_status = 'removido' THEN now() ELSE removido_em END,
    proxima_confirmacao_em = CASE
      WHEN p_status = 'ativo' THEN now() + interval '7 days'
      WHEN p_status IN ('vendido', 'inativo', 'removido') THEN NULL
      ELSE proxima_confirmacao_em
    END,
    confirmacao_solicitada_em = CASE WHEN p_status <> 'aguardando_confirmacao' THEN NULL ELSE confirmacao_solicitada_em END,
    limite_resposta_em = CASE WHEN p_status <> 'aguardando_confirmacao' THEN NULL ELSE limite_resposta_em END,
    updated_at = now()
  WHERE id = p_anuncio_id
    AND (empresa_id = v_empresa_id OR public.is_super_admin());

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.negocio_toggle_favorito(p_anuncio_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.negocio_favoritos
    WHERE empresa_id = v_empresa_id
      AND anuncio_id = p_anuncio_id
  ) THEN
    DELETE FROM public.negocio_favoritos
    WHERE empresa_id = v_empresa_id
      AND anuncio_id = p_anuncio_id;
    RETURN false;
  END IF;

  INSERT INTO public.negocio_favoritos (empresa_id, anuncio_id)
  VALUES (v_empresa_id, p_anuncio_id)
  ON CONFLICT (empresa_id, anuncio_id) DO NOTHING;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.negocio_registrar_denuncia(
  p_anuncio_id uuid,
  p_motivo public.negocio_motivo_denuncia,
  p_descricao text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_user_id uuid := auth.uid();
  v_dono_anuncio uuid;
  v_id uuid;
BEGIN
  IF v_empresa_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'contexto_invalido';
  END IF;

  SELECT empresa_id INTO v_dono_anuncio
  FROM public.negocio_anuncios
  WHERE id = p_anuncio_id;

  IF v_dono_anuncio IS NULL THEN
    RAISE EXCEPTION 'anuncio_not_found';
  END IF;

  IF v_dono_anuncio = v_empresa_id THEN
    RAISE EXCEPTION 'nao_eh_permitido_denunciar_proprio_anuncio';
  END IF;

  INSERT INTO public.negocio_denuncias (
    anuncio_id, denunciante_empresa_id, denunciante_user_id, motivo, descricao
  ) VALUES (
    p_anuncio_id, v_empresa_id, v_user_id, p_motivo, p_descricao
  )
  ON CONFLICT (anuncio_id, denunciante_empresa_id, motivo)
  DO UPDATE SET descricao = EXCLUDED.descricao
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.negocio_confirmar_disponibilidade(
  p_anuncio_id uuid,
  p_resposta public.negocio_resposta_confirmacao
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  IF p_resposta = 'ainda_disponivel' THEN
    UPDATE public.negocio_anuncios
    SET
      status = 'ativo',
      ultima_confirmacao_em = now(),
      proxima_confirmacao_em = now() + interval '7 days',
      confirmacao_solicitada_em = NULL,
      limite_resposta_em = NULL,
      updated_at = now()
    WHERE id = p_anuncio_id
      AND empresa_id = v_empresa_id;
  ELSIF p_resposta = 'vendido' THEN
    UPDATE public.negocio_anuncios
    SET
      status = 'vendido',
      confirmacao_solicitada_em = NULL,
      limite_resposta_em = NULL,
      proxima_confirmacao_em = NULL,
      updated_at = now()
    WHERE id = p_anuncio_id
      AND empresa_id = v_empresa_id;
  ELSE
    UPDATE public.negocio_anuncios
    SET
      status = 'pausado',
      confirmacao_solicitada_em = NULL,
      limite_resposta_em = NULL,
      updated_at = now()
    WHERE id = p_anuncio_id
      AND empresa_id = v_empresa_id;
  END IF;

  UPDATE public.negocio_confirmacoes_log
  SET respondida_em = now(), resposta = p_resposta
  WHERE anuncio_id = p_anuncio_id
    AND respondida_em IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.negocio_listar_anuncios(
  p_busca text DEFAULT NULL,
  p_tipo public.negocio_tipo_oportunidade DEFAULT NULL,
  p_categoria_id uuid DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_somente_favoritos boolean DEFAULT false,
  p_somente_meus boolean DEFAULT false,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0
) RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  tipo_oportunidade public.negocio_tipo_oportunidade,
  categoria_id uuid,
  categoria_nome text,
  subcategoria_id uuid,
  subcategoria_nome text,
  titulo text,
  descricao text,
  preco_centavos bigint,
  preco_a_combinar boolean,
  cidade text,
  estado text,
  status public.negocio_status_anuncio,
  publicado_em timestamptz,
  updated_at timestamptz,
  favoritado boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id,
    a.empresa_id,
    a.tipo_oportunidade,
    a.categoria_id,
    c.nome AS categoria_nome,
    a.subcategoria_id,
    s.nome AS subcategoria_nome,
    a.titulo,
    a.descricao,
    a.preco_centavos,
    a.preco_a_combinar,
    a.cidade,
    a.estado,
    a.status,
    a.publicado_em,
    a.updated_at,
    (f.id IS NOT NULL) AS favoritado
  FROM public.negocio_anuncios a
  JOIN public.negocio_categorias c ON c.id = a.categoria_id
  LEFT JOIN public.negocio_subcategorias s ON s.id = a.subcategoria_id
  LEFT JOIN public.negocio_favoritos f
    ON f.anuncio_id = a.id
   AND f.empresa_id = public.minha_empresa_id()
  WHERE
    (
      p_somente_meus = true AND a.empresa_id = public.minha_empresa_id()
      OR p_somente_meus = false AND (
        a.status = 'ativo'
        OR a.empresa_id = public.minha_empresa_id()
        OR public.is_super_admin()
      )
    )
    AND (p_somente_favoritos = false OR f.id IS NOT NULL)
    AND (p_tipo IS NULL OR a.tipo_oportunidade = p_tipo)
    AND (p_categoria_id IS NULL OR a.categoria_id = p_categoria_id)
    AND (COALESCE(trim(p_estado), '') = '' OR upper(a.estado) = upper(trim(p_estado)))
    AND (COALESCE(trim(p_cidade), '') = '' OR a.cidade ILIKE trim(p_cidade))
    AND (
      COALESCE(trim(p_busca), '') = ''
      OR a.titulo ILIKE '%' || trim(p_busca) || '%'
      OR a.descricao ILIKE '%' || trim(p_busca) || '%'
    )
  ORDER BY
    CASE WHEN a.status = 'ativo' THEN 0 ELSE 1 END,
    a.publicado_em DESC NULLS LAST,
    a.updated_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.negocio_detalhar_anuncio(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'empresa_id', a.empresa_id,
    'tipo_oportunidade', a.tipo_oportunidade,
    'categoria_id', a.categoria_id,
    'categoria_nome', c.nome,
    'subcategoria_id', a.subcategoria_id,
    'subcategoria_nome', s.nome,
    'titulo', a.titulo,
    'descricao', a.descricao,
    'preco_centavos', a.preco_centavos,
    'preco_a_combinar', a.preco_a_combinar,
    'cidade', a.cidade,
    'estado', a.estado,
    'status', a.status,
    'publicado_em', a.publicado_em,
    'proxima_confirmacao_em', a.proxima_confirmacao_em,
    'confirmacao_solicitada_em', a.confirmacao_solicitada_em,
    'limite_resposta_em', a.limite_resposta_em,
    'ultima_confirmacao_em', a.ultima_confirmacao_em,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'favoritado', EXISTS (
      SELECT 1 FROM public.negocio_favoritos f
      WHERE f.anuncio_id = a.id
        AND f.empresa_id = public.minha_empresa_id()
    ),
    'contatos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ct.id,
        'canal', ct.canal,
        'valor', ct.valor,
        'ordem', ct.ordem
      ) ORDER BY ct.ordem, ct.created_at)
      FROM public.negocio_anuncio_contatos ct
      WHERE ct.anuncio_id = a.id
    ), '[]'::jsonb),
    'imagens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', im.id,
        'storage_path', im.storage_path,
        'ordem', im.ordem
      ) ORDER BY im.ordem, im.created_at)
      FROM public.negocio_anuncio_imagens im
      WHERE im.anuncio_id = a.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.negocio_anuncios a
  JOIN public.negocio_categorias c ON c.id = a.categoria_id
  LEFT JOIN public.negocio_subcategorias s ON s.id = a.subcategoria_id
  WHERE a.id = p_id
    AND (
      a.status = 'ativo'
      OR a.empresa_id = public.minha_empresa_id()
      OR public.is_super_admin()
    )
  LIMIT 1;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.negocio_job_confirmacao_diaria()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitados int := 0;
  v_inativados int := 0;
BEGIN
  WITH cte AS (
    UPDATE public.negocio_anuncios a
    SET
      status = 'aguardando_confirmacao',
      confirmacao_solicitada_em = now(),
      limite_resposta_em = now() + interval '48 hours',
      updated_at = now()
    WHERE a.status = 'ativo'
      AND a.proxima_confirmacao_em IS NOT NULL
      AND a.proxima_confirmacao_em <= now()
    RETURNING a.id, a.limite_resposta_em
  ), ins AS (
    INSERT INTO public.negocio_confirmacoes_log (
      anuncio_id,
      solicitada_em,
      limite_resposta_em,
      origem
    )
    SELECT id, now(), now() + interval '48 hours', 'scheduler'
    FROM cte
    RETURNING id
  )
  SELECT COUNT(*) INTO v_solicitados FROM ins;

  WITH cte2 AS (
    UPDATE public.negocio_anuncios a
    SET
      status = 'inativo',
      updated_at = now()
    WHERE a.status = 'aguardando_confirmacao'
      AND a.limite_resposta_em IS NOT NULL
      AND a.limite_resposta_em <= now()
    RETURNING a.id
  )
  SELECT COUNT(*) INTO v_inativados FROM cte2;

  RETURN jsonb_build_object(
    'solicitados', v_solicitados,
    'inativados', v_inativados
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Seeds iniciais
-- -----------------------------------------------------------------------------
INSERT INTO public.negocio_categorias (nome, slug, descricao, ordem)
VALUES
  ('Veículos', 'veiculos', 'Venda e compra de veículos e frotas', 10),
  ('Peças e Acessórios', 'pecas-acessorios', 'Peças, pneus, acessórios e suprimentos', 20),
  ('Serviços', 'servicos', 'Serviços operacionais e de apoio', 30),
  ('Parcerias', 'parcerias', 'Oportunidades de parceria e cooperação', 40)
ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Scheduler diário (best effort)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'negocio-confirmacao-diaria'
      ) THEN
        PERFORM cron.schedule(
          'negocio-confirmacao-diaria',
          '0 8 * * *',
          $job$select public.negocio_job_confirmacao_diaria();$job$
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
