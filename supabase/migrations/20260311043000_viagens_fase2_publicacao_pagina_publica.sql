-- Módulo Viagens (Fase 2): publicação e página pública por slug

CREATE OR REPLACE FUNCTION public.slugify_viagem(input text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v text;
BEGIN
  v := lower(trim(COALESCE(input, '')));
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '(^-+|-+$)', '', 'g');
  IF v = '' THEN
    RETURN NULL;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_viagens_publicar(
  p_viagem_id uuid,
  p_slug_sugerido text DEFAULT NULL
)
RETURNS public.viagens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_viagem public.viagens;
  v_base_slug text;
  v_slug text;
  v_tentativa integer := 0;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Sem empresa vinculada para publicar viagem';
  END IF;

  SELECT *
    INTO v_viagem
  FROM public.viagens
  WHERE id = p_viagem_id
    AND empresa_id = v_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada';
  END IF;

  v_base_slug := public.slugify_viagem(COALESCE(NULLIF(trim(p_slug_sugerido), ''), v_viagem.slug_publico, v_viagem.codigo, v_viagem.titulo));
  IF v_base_slug IS NULL THEN
    v_base_slug := 'viagem';
  END IF;

  v_slug := v_base_slug;

  WHILE EXISTS (SELECT 1 FROM public.viagens x WHERE x.slug_publico = v_slug AND x.id <> v_viagem.id) LOOP
    v_tentativa := v_tentativa + 1;
    v_slug := v_base_slug || '-' || v_tentativa::text;
  END LOOP;

  UPDATE public.viagens
     SET slug_publico = v_slug,
         publicada_em = COALESCE(publicada_em, now()),
         status = CASE WHEN status = 'rascunho' THEN 'publicada'::public.viagem_status ELSE status END,
         updated_at = now()
   WHERE id = v_viagem.id
   RETURNING * INTO v_viagem;

  RETURN v_viagem;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_viagens_publicar(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.public_get_viagem_by_slug(
  p_slug text
)
RETURNS TABLE (
  id uuid,
  titulo text,
  categoria public.viagem_categoria,
  status public.viagem_status,
  data_ida date,
  hora_saida time,
  data_retorno date,
  hora_retorno_prevista time,
  prazo_final_venda_online timestamptz,
  cidade_saida text,
  local_embarque text,
  cidade_destino text,
  valor numeric,
  valor_promocional numeric,
  descricao_curta text,
  descricao_completa text,
  inclui text,
  nao_inclui text,
  observacoes text,
  documentos_obrigatorios text,
  politica_cancelamento text,
  imagem_principal_url text,
  banner_url text,
  slug_publico text,
  vagas_disponiveis_texto text,
  venda_online_aberta boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.titulo,
    v.categoria,
    v.status,
    v.data_ida,
    v.hora_saida,
    v.data_retorno,
    v.hora_retorno_prevista,
    v.prazo_final_venda_online,
    v.cidade_saida,
    v.local_embarque,
    v.cidade_destino,
    v.valor,
    v.valor_promocional,
    v.descricao_curta,
    v.descricao_completa,
    v.inclui,
    v.nao_inclui,
    v.observacoes,
    v.documentos_obrigatorios,
    v.politica_cancelamento,
    v.imagem_principal_url,
    v.banner_url,
    v.slug_publico,
    CASE
      WHEN v.vendas_ilimitadas THEN 'Vagas ilimitadas'
      WHEN v.capacidade_total IS NULL THEN 'A consultar'
      ELSE v.capacidade_total::text || ' vagas'
    END AS vagas_disponiveis_texto,
    (
      v.status IN ('publicada', 'vendas_abertas')
      AND (
        v.prazo_final_venda_online IS NULL
        OR now() <= v.prazo_final_venda_online
      )
    ) AS venda_online_aberta
  FROM public.viagens v
  WHERE v.slug_publico = p_slug
    AND v.status <> 'cancelada'::public.viagem_status
    AND v.publicada_em IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_viagem_by_slug(text) TO anon, authenticated;
