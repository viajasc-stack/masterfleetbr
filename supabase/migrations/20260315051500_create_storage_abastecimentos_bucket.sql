-- Bucket dedicado para comprovantes de abastecimento

INSERT INTO storage.buckets (id, name, public)
VALUES ('abastecimentos', 'abastecimentos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "abastecimentos_storage_select" ON storage.objects;
CREATE POLICY "abastecimentos_storage_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'abastecimentos');

DROP POLICY IF EXISTS "abastecimentos_storage_insert" ON storage.objects;
CREATE POLICY "abastecimentos_storage_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'abastecimentos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "abastecimentos_storage_update" ON storage.objects;
CREATE POLICY "abastecimentos_storage_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'abastecimentos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'abastecimentos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "abastecimentos_storage_delete" ON storage.objects;
CREATE POLICY "abastecimentos_storage_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'abastecimentos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);
