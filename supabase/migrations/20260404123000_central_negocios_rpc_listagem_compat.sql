-- Compatibilidade de assinatura para PostgREST/Supabase RPC cache
-- Cenário observado: resolução por conjunto/ordem de parâmetros variando por cliente/cache.

CREATE OR REPLACE FUNCTION public.negocio_listar_anuncios(
  p_busca text,
  p_categoria_id uuid,
  p_cidade text,
  p_estado text,
  p_limit int,
  p_offset int,
  p_somente_favoritos boolean,
  p_somente_meus boolean,
  p_tipo text
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
  SELECT *
  FROM public.negocio_listar_anuncios(
    p_busca := p_busca,
    p_tipo := CASE
      WHEN COALESCE(trim(p_tipo), '') = '' THEN NULL
      ELSE p_tipo::public.negocio_tipo_oportunidade
    END,
    p_categoria_id := p_categoria_id,
    p_estado := p_estado,
    p_cidade := p_cidade,
    p_somente_favoritos := COALESCE(p_somente_favoritos, false),
    p_somente_meus := COALESCE(p_somente_meus, false),
    p_limit := COALESCE(p_limit, 30),
    p_offset := COALESCE(p_offset, 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.negocio_listar_anuncios(
  p_limit int,
  p_offset int,
  p_somente_favoritos boolean,
  p_somente_meus boolean
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
  SELECT *
  FROM public.negocio_listar_anuncios(
    p_busca := NULL,
    p_tipo := NULL,
    p_categoria_id := NULL,
    p_estado := NULL,
    p_cidade := NULL,
    p_somente_favoritos := COALESCE(p_somente_favoritos, false),
    p_somente_meus := COALESCE(p_somente_meus, false),
    p_limit := COALESCE(p_limit, 30),
    p_offset := COALESCE(p_offset, 0)
  );
$$;
