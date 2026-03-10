-- Branding público (logo) configurável pelo painel master

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "branding_storage_select" ON storage.objects;
CREATE POLICY "branding_storage_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'branding');

DROP POLICY IF EXISTS "branding_storage_insert" ON storage.objects;
CREATE POLICY "branding_storage_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'branding'
  AND public.is_super_admin()
);

DROP POLICY IF EXISTS "branding_storage_update" ON storage.objects;
CREATE POLICY "branding_storage_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'branding'
  AND public.is_super_admin()
)
WITH CHECK (
  bucket_id = 'branding'
  AND public.is_super_admin()
);

DROP POLICY IF EXISTS "branding_storage_delete" ON storage.objects;
CREATE POLICY "branding_storage_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'branding'
  AND public.is_super_admin()
);

CREATE OR REPLACE FUNCTION public.get_public_branding()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branding jsonb := '{}'::jsonb;
BEGIN
  IF to_regclass('public.master_settings') IS NULL THEN
    RETURN jsonb_build_object('logo_url', NULL);
  END IF;

  SELECT COALESCE(ms.value, '{}'::jsonb)
    INTO v_branding
  FROM public.master_settings ms
  WHERE ms.key = 'branding'
  LIMIT 1;

  RETURN jsonb_build_object(
    'logo_url', NULLIF(COALESCE(v_branding->>'logo_url', ''), '')
  );
END;
$$;
