-- Adiciona coluna updated_at e trigger de atualização em public.veiculos

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at_veiculos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_veiculos_updated_at'
  ) THEN
    CREATE TRIGGER trg_veiculos_updated_at
      BEFORE UPDATE ON public.veiculos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_veiculos();
  END IF;
END;
$$;
