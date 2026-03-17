-- Suporte a arquivo físico em contratos

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS contrato_fisico_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "contratos_storage_select" ON storage.objects;
CREATE POLICY "contratos_storage_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'contratos');

DROP POLICY IF EXISTS "contratos_storage_insert" ON storage.objects;
CREATE POLICY "contratos_storage_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'contratos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "contratos_storage_update" ON storage.objects;
CREATE POLICY "contratos_storage_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'contratos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'contratos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "contratos_storage_delete" ON storage.objects;
CREATE POLICY "contratos_storage_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'contratos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);
