-- =============================================================================
-- Ajuste final do billing modular:
-- - novas assinaturas passam a nascer como "modular"
-- - admin_mark_paid mantém a assinatura no modelo modular
-- - backfill defensivo para assinaturas ainda em "plano"
-- =============================================================================

ALTER TABLE public.assinaturas
  ALTER COLUMN billing_model SET DEFAULT 'modular';

UPDATE public.assinaturas
SET billing_model = 'modular', updated_at = now()
WHERE billing_model IS DISTINCT FROM 'modular';

DROP FUNCTION IF EXISTS public.admin_mark_paid(uuid);

CREATE OR REPLACE FUNCTION public.admin_mark_paid(p_fatura_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f record;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id, empresa_id, assinatura_id, status
    INTO f
    FROM public.faturas
   WHERE id = p_fatura_id
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.faturas
     SET status = 'paga', updated_at = now()
   WHERE id = p_fatura_id;

  IF f.assinatura_id IS NOT NULL THEN
    UPDATE public.assinaturas
       SET status = 'ativa',
           billing_model = 'modular',
           proxima_cobranca = (current_date + interval '1 month')::date,
           updated_at = now()
     WHERE id = f.assinatura_id;
  END IF;

  RETURN TRUE;
END;
$$;