-- Add email column to empresas (needed for E2E tests)
ALTER TABLE IF EXISTS public.empresas
ADD COLUMN IF NOT EXISTS email text;

-- Optionally set a default or update existing rows if desired
-- UPDATE public.empresas SET email = NULL WHERE email IS NULL;
