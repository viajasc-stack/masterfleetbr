-- URL personalizada por plano:
-- - Enterprise/Top: somente subdomínio da plataforma
-- - Supremo: domínio próprio (e também subdomínio, se desejar)

CREATE OR REPLACE FUNCTION public.is_enterprise_or_top_plan(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assinaturas a
    LEFT JOIN public.planos p ON p.id = a.plano_id
    WHERE a.empresa_id = p_empresa_id
      AND COALESCE(a.status, 'trial') IN ('trial', 'ativa')
      AND COALESCE(lower(p.codigo), '') IN ('enterprise', 'top')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_supremo_plan(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assinaturas a
    LEFT JOIN public.planos p ON p.id = a.plano_id
    WHERE a.empresa_id = p_empresa_id
      AND COALESCE(a.status, 'trial') IN ('trial', 'ativa')
      AND COALESCE(lower(p.codigo), '') = 'supremo'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_custom_domain()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_empresa record;
  v_plano_codigo text;
  v_plano_nome text;
  v_allowed_subdomain boolean := false;
  v_allowed_custom_domain boolean := false;
  v_base_domain text := COALESCE(NULLIF(current_setting('app.public_base_domain', true), ''), 'masterfleetbr.com.br');
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  SELECT e.id, e.nome, e.subdominio_personalizado, e.dominio_personalizado, e.dominio_status, e.dominio_ssl_status, e.dominio_verificado_em, e.dominio_erro
    INTO v_empresa
    FROM public.empresas e
   WHERE e.id = v_empresa_id
   LIMIT 1;

  SELECT p.codigo, p.nome
    INTO v_plano_codigo, v_plano_nome
    FROM public.assinaturas a
    LEFT JOIN public.planos p ON p.id = a.plano_id
   WHERE a.empresa_id = v_empresa_id
   LIMIT 1;

  v_allowed_subdomain := public.is_enterprise_or_top_plan(v_empresa_id) OR public.is_supremo_plan(v_empresa_id);
  v_allowed_custom_domain := public.is_supremo_plan(v_empresa_id);

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'empresa_nome', v_empresa.nome,
    'plano_codigo', v_plano_codigo,
    'plano_nome', v_plano_nome,
    'allowed', (v_allowed_subdomain OR v_allowed_custom_domain),
    'allowed_subdomain', v_allowed_subdomain,
    'allowed_custom_domain', v_allowed_custom_domain,
    'base_domain', v_base_domain,
    'subdominio_personalizado', v_empresa.subdominio_personalizado,
    'dominio_personalizado', v_empresa.dominio_personalizado,
    'dominio_status', v_empresa.dominio_status,
    'dominio_ssl_status', v_empresa.dominio_ssl_status,
    'dominio_verificado_em', v_empresa.dominio_verificado_em,
    'dominio_erro', v_empresa.dominio_erro,
    'host_ativo', CASE
      WHEN v_empresa.dominio_status <> 'ativo' THEN NULL
      WHEN COALESCE(v_empresa.dominio_personalizado, '') <> '' THEN lower(v_empresa.dominio_personalizado)
      WHEN COALESCE(v_empresa.subdominio_personalizado, '') <> '' THEN lower(v_empresa.subdominio_personalizado) || '.' || lower(v_base_domain)
      ELSE NULL
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_custom_subdomain(p_subdomain text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_sub text;
  v_reserved text[] := ARRAY['www', 'app', 'api', 'admin', 'master', 'painel', 'suporte', 'login', 'cadastro'];
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF NOT (public.is_enterprise_or_top_plan(v_empresa_id) OR public.is_supremo_plan(v_empresa_id)) THEN
    RAISE EXCEPTION 'plano_subdomain_not_allowed';
  END IF;

  v_sub := lower(COALESCE(btrim(p_subdomain), ''));

  IF v_sub = '' THEN
    RAISE EXCEPTION 'subdomain_required';
  END IF;

  IF v_sub = ANY(v_reserved) THEN
    RAISE EXCEPTION 'subdomain_reserved';
  END IF;

  IF v_sub !~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'subdomain_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id <> v_empresa_id
      AND lower(COALESCE(e.subdominio_personalizado, '')) = v_sub
  ) THEN
    RAISE EXCEPTION 'subdomain_unavailable';
  END IF;

  UPDATE public.empresas
     SET subdominio_personalizado = v_sub,
         dominio_personalizado = NULL,
         dominio_status = 'pendente',
         dominio_ssl_status = 'pendente',
         dominio_verificado_em = NULL,
         dominio_erro = NULL
   WHERE id = v_empresa_id;

  RETURN v_sub;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_custom_domain(p_domain text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_domain text;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  IF NOT public.is_supremo_plan(v_empresa_id) THEN
    RAISE EXCEPTION 'plano_domain_not_allowed';
  END IF;

  v_domain := lower(COALESCE(btrim(p_domain), ''));

  IF v_domain = '' THEN
    RAISE EXCEPTION 'domain_required';
  END IF;

  IF v_domain ~ '^https?://' OR position('/' in v_domain) > 0 THEN
    RAISE EXCEPTION 'domain_invalid';
  END IF;

  IF v_domain !~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'domain_invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.id <> v_empresa_id
      AND lower(COALESCE(e.dominio_personalizado, '')) = v_domain
  ) THEN
    RAISE EXCEPTION 'domain_unavailable';
  END IF;

  UPDATE public.empresas
     SET dominio_personalizado = v_domain,
         subdominio_personalizado = NULL,
         dominio_status = 'pendente',
         dominio_ssl_status = 'pendente',
         dominio_verificado_em = NULL,
         dominio_erro = NULL
   WHERE id = v_empresa_id;

  RETURN v_domain;
END;
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
