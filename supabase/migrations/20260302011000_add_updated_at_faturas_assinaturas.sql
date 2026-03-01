-- Add updated_at timestamp columns used by billing RPCs
ALTER TABLE IF EXISTS public.faturas
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS public.assinaturas
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
