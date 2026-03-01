-- Ensure set_empresa_id_contratos preserves provided empresa_id when present
CREATE OR REPLACE FUNCTION public.set_empresa_id_contratos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF COALESCE(NEW.empresa_id::text, '') = '' THEN
    NEW.empresa_id := public.minha_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;
