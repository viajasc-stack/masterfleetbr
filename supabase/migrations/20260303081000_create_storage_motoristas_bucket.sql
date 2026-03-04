-- Bucket e policies para arquivos de motoristas

INSERT INTO storage.buckets (id, name, public)
VALUES ('motoristas', 'motoristas', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "motoristas_storage_select" ON storage.objects;
CREATE POLICY "motoristas_storage_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'motoristas');

DROP POLICY IF EXISTS "motoristas_storage_insert" ON storage.objects;
CREATE POLICY "motoristas_storage_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'motoristas'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "motoristas_storage_update" ON storage.objects;
CREATE POLICY "motoristas_storage_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'motoristas'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'motoristas'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "motoristas_storage_delete" ON storage.objects;
CREATE POLICY "motoristas_storage_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'motoristas'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);