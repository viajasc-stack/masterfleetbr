-- URL personalizada para plano Supremo/Top
-- - Configuração por empresa (subdomínio ou domínio próprio)
-- - Validação de disponibilidade
-- - RPC de resolução por host para uso em proxy/middleware

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS subdominio_personalizado text,
  ADD COLUMN IF NOT EXISTS dominio_personalizado text,
  ADD COLUMN IF NOT EXISTS dominio_status text NOT NULL DEFAULT 'desativado',
  ADD COLUMN IF NOT EXISTS dominio_ssl_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS dominio_verificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS dominio_erro text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_dominio_status_chk'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_dominio_status_chk
      CHECK (dominio_status IN ('desativado', 'pendente', 'ativo', 'erro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresas_dominio_ssl_status_chk'
  ) THEN
    ALTER TABLE public.empresas
      ADD CONSTRAINT empresas_dominio_ssl_status_chk
      CHECK (dominio_ssl_status IN ('pendente', 'ativo', 'erro'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_subdominio_personalizado_unique
  ON public.empresas (lower(subdominio_personalizado))
  WHERE subdominio_personalizado IS NOT NULL AND btrim(subdominio_personalizado) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_dominio_personalizado_unique
  ON public.empresas (lower(dominio_personalizado))
  WHERE dominio_personalizado IS NOT NULL AND btrim(dominio_personalizado) <> '';

CREATE OR REPLACE FUNCTION public.is_top_or_supremo_plan(p_empresa_id uuid)
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
      AND COALESCE(lower(p.codigo), '') IN ('top', 'supremo')
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
  v_allowed boolean := false;
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

  v_allowed := public.is_top_or_supremo_plan(v_empresa_id);

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'empresa_nome', v_empresa.nome,
    'plano_codigo', v_plano_codigo,
    'plano_nome', v_plano_nome,
    'allowed', v_allowed,
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

  IF NOT public.is_top_or_supremo_plan(v_empresa_id) THEN
    RAISE EXCEPTION 'plano_not_allowed';
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

  IF NOT public.is_top_or_supremo_plan(v_empresa_id) THEN
    RAISE EXCEPTION 'plano_not_allowed';
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

CREATE OR REPLACE FUNCTION public.clear_my_custom_domain()
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

  UPDATE public.empresas
     SET subdominio_personalizado = NULL,
         dominio_personalizado = NULL,
         dominio_status = 'desativado',
         dominio_ssl_status = 'pendente',
         dominio_verificado_em = NULL,
         dominio_erro = NULL
   WHERE id = v_empresa_id;

  RETURN true;
END;
$$;

-- Ativação/erro de domínio (uso operacional por super admin)
CREATE OR REPLACE FUNCTION public.master_set_empresa_domain_status(
  p_empresa_id uuid,
  p_status text,
  p_ssl_status text DEFAULT 'pendente',
  p_erro text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF COALESCE(lower(p_status), '') NOT IN ('desativado', 'pendente', 'ativo', 'erro') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF COALESCE(lower(p_ssl_status), '') NOT IN ('pendente', 'ativo', 'erro') THEN
    RAISE EXCEPTION 'invalid_ssl_status';
  END IF;

  UPDATE public.empresas
     SET dominio_status = lower(p_status),
         dominio_ssl_status = lower(p_ssl_status),
         dominio_verificado_em = CASE WHEN lower(p_status) = 'ativo' THEN now() ELSE NULL END,
         dominio_erro = NULLIF(btrim(COALESCE(p_erro, '')), '')
   WHERE id = p_empresa_id;

  RETURN FOUND;
END;
$$;

-- RPC pública para resolver tenant por host (proxy/middleware)
CREATE OR REPLACE FUNCTION public.resolve_tenant_by_host(p_host text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host text := lower(split_part(COALESCE(p_host, ''), ':', 1));
  v_base_domain text := lower(COALESCE(NULLIF(current_setting('app.public_base_domain', true), ''), 'masterfleetbr.com.br'));
  v_empresa record;
BEGIN
  IF v_host = '' THEN
    RETURN NULL;
  END IF;

  SELECT e.id, e.nome, e.subdominio_personalizado, e.dominio_personalizado
    INTO v_empresa
    FROM public.empresas e
   WHERE e.dominio_status = 'ativo'
     AND (
       (COALESCE(e.dominio_personalizado, '') <> '' AND lower(e.dominio_personalizado) = v_host)
       OR
       (COALESCE(e.subdominio_personalizado, '') <> '' AND lower(e.subdominio_personalizado) || '.' || v_base_domain = v_host)
     )
   LIMIT 1;

  IF v_empresa.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', v_empresa.id,
    'empresa_nome', v_empresa.nome,
    'host', v_host,
    'base_domain', v_base_domain,
    'source', CASE WHEN COALESCE(v_empresa.dominio_personalizado, '') <> '' THEN 'custom_domain' ELSE 'subdomain' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_custom_domain() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_custom_subdomain(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_custom_domain(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_my_custom_domain() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_host(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
