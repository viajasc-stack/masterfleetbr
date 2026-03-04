-- Fase 1 hardening: assinatura operacional da OS + evidências/regras de abastecimento

-- 1) Campos de assinatura operacional na OS (usados no app motorista)
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS assinatura_inicio_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_inicio_hash text,
  ADD COLUMN IF NOT EXISTS assinatura_inicio_geo jsonb,
  ADD COLUMN IF NOT EXISTS assinatura_inicio_endereco text,
  ADD COLUMN IF NOT EXISTS assinatura_inicio_foto_url text,
  ADD COLUMN IF NOT EXISTS assinatura_fim_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_fim_hash text,
  ADD COLUMN IF NOT EXISTS assinatura_fim_geo jsonb,
  ADD COLUMN IF NOT EXISTS assinatura_fim_endereco text,
  ADD COLUMN IF NOT EXISTS assinatura_fim_foto_url text;

-- 2) Bucket para evidências do odômetro
INSERT INTO storage.buckets (id, name, public)
VALUES ('odometro', 'odometro', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "odometro_storage_select" ON storage.objects;
CREATE POLICY "odometro_storage_select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'odometro');

DROP POLICY IF EXISTS "odometro_storage_insert" ON storage.objects;
CREATE POLICY "odometro_storage_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'odometro'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "odometro_storage_update" ON storage.objects;
CREATE POLICY "odometro_storage_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'odometro'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'odometro'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

DROP POLICY IF EXISTS "odometro_storage_delete" ON storage.objects;
CREATE POLICY "odometro_storage_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'odometro'
  AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
);

-- 3) Regras centralizadas de abastecimento (permissão + evidência)
CREATE OR REPLACE FUNCTION public.enforce_abastecimento_business_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pode_abastecer boolean;
BEGIN
  -- Regra: motorista sem permissão não pode registrar abastecimento direto
  IF NEW.motorista_id IS NOT NULL AND COALESCE(NEW.tipo, 'registro') = 'registro' THEN
    SELECT m.pode_abastecer
      INTO v_pode_abastecer
      FROM public.motoristas m
     WHERE m.id = NEW.motorista_id
     LIMIT 1;

    IF COALESCE(v_pode_abastecer, false) = false THEN
      RAISE EXCEPTION 'Ação não permitida: motorista sem permissão para registrar abastecimento direto.';
    END IF;
  END IF;

  -- Regra: abastecimento em posto exige evidência (cupom)
  IF COALESCE(NEW.origem_abastecimento, '') = 'posto'
     AND COALESCE(NEW.tipo, 'registro') = 'registro'
     AND NULLIF(COALESCE(NEW.cupom_url, ''), '') IS NULL THEN
    RAISE EXCEPTION 'Ação não permitida: abastecimento em posto exige cupom fiscal.';
  END IF;

  -- Regra: solicitação precisa justificativa
  IF COALESCE(NEW.tipo, '') = 'solicitacao'
     AND NULLIF(COALESCE(NEW.observacao, ''), '') IS NULL THEN
    RAISE EXCEPTION 'Ação não permitida: solicitação de abastecimento exige justificativa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_abastecimentos_enforce_business_rules ON public.abastecimentos;
CREATE TRIGGER trg_abastecimentos_enforce_business_rules
  BEFORE INSERT OR UPDATE ON public.abastecimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_abastecimento_business_rules();
