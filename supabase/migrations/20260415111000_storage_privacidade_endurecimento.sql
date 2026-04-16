-- Endurecimento de privacidade entre empresas para buckets do app motorista.
-- Objetivos:
-- 1) tornar buckets sensíveis privados;
-- 2) restringir SELECT por empresa (primeira pasta = minha_empresa_id()).

UPDATE storage.buckets
   SET public = false
 WHERE id IN ('motoristas', 'odometro', 'abastecimentos');

-- motoristas
DROP POLICY IF EXISTS "motoristas_storage_select" ON storage.objects;
CREATE POLICY "motoristas_storage_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'motoristas'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

-- odometro
DROP POLICY IF EXISTS "odometro_storage_select" ON storage.objects;
CREATE POLICY "odometro_storage_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'odometro'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

-- abastecimentos
DROP POLICY IF EXISTS "abastecimentos_storage_select" ON storage.objects;
CREATE POLICY "abastecimentos_storage_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'abastecimentos'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);
