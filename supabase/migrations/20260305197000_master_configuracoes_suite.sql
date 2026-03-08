-- Suite inicial de Configurações do Painel Master

CREATE TABLE IF NOT EXISTS public.master_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_feature_flags_unique_scope
  ON public.master_feature_flags (code, COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION public.master_get_config_bundle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_super_admins jsonb := '[]'::jsonb;
  v_settings jsonb := '{}'::jsonb;
  v_flags jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF to_regclass('public.super_admins') IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id', sa.user_id,
          'email', au.email,
          'created_at', sa.created_at
        )
        ORDER BY sa.created_at DESC
      ),
      '[]'::jsonb
    )
    INTO v_super_admins
    FROM public.super_admins sa
    LEFT JOIN auth.users au ON au.id = sa.user_id;
  END IF;

  SELECT COALESCE(jsonb_object_agg(ms.key, ms.value), '{}'::jsonb)
  INTO v_settings
  FROM public.master_settings ms;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', mf.id,
        'code', mf.code,
        'description', mf.description,
        'enabled', mf.enabled,
        'empresa_id', mf.empresa_id,
        'updated_at', mf.updated_at
      )
      ORDER BY mf.code, mf.updated_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_flags
  FROM public.master_feature_flags mf;

  RETURN jsonb_build_object(
    'super_admins', v_super_admins,
    'settings', v_settings,
    'feature_flags', v_flags
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_setting(
  p_key text,
  p_value jsonb
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

  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'setting_key_required';
  END IF;

  INSERT INTO public.master_settings (key, value, updated_at)
  VALUES (btrim(p_key), COALESCE(p_value, '{}'::jsonb), now())
  ON CONFLICT (key)
  DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_add_super_admin_by_email(
  p_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT u.id
  INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found_by_email';
  END IF;

  INSERT INTO public.super_admins (user_id, created_by)
  VALUES (v_user_id, auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_remove_super_admin(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.super_admins;
  IF v_count <= 1 THEN
    RAISE EXCEPTION 'cannot_remove_last_super_admin';
  END IF;

  DELETE FROM public.super_admins WHERE user_id = p_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_feature_flag(
  p_id uuid DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_enabled boolean DEFAULT true,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_code text := btrim(p_code);
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_code IS NULL OR v_code = '' THEN
    RAISE EXCEPTION 'feature_flag_code_required';
  END IF;

  IF p_id IS NULL THEN
    SELECT mf.id
      INTO v_id
      FROM public.master_feature_flags mf
     WHERE mf.code = v_code
       AND COALESCE(mf.empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(p_empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)
     LIMIT 1;

    IF v_id IS NULL THEN
      INSERT INTO public.master_feature_flags (code, description, enabled, empresa_id, updated_at)
      VALUES (v_code, NULLIF(btrim(p_description), ''), COALESCE(p_enabled, true), p_empresa_id, now())
      RETURNING id INTO v_id;
    ELSE
      UPDATE public.master_feature_flags
      SET
        description = NULLIF(btrim(p_description), ''),
        enabled = COALESCE(p_enabled, enabled),
        updated_at = now()
      WHERE id = v_id
      RETURNING id INTO v_id;
    END IF;
  ELSE
    UPDATE public.master_feature_flags
    SET
      code = v_code,
      description = NULLIF(btrim(p_description), ''),
      enabled = COALESCE(p_enabled, enabled),
      empresa_id = p_empresa_id,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'feature_flag_not_saved';
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_delete_feature_flag(
  p_id uuid
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

  DELETE FROM public.master_feature_flags WHERE id = p_id;
  RETURN FOUND;
END;
$$;
