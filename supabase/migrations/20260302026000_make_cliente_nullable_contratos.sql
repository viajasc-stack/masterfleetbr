-- Allow contratos.cliente_id to be nullable to support auto-created contracts without explicit cliente
ALTER TABLE IF EXISTS public.contratos
ALTER COLUMN cliente_id DROP NOT NULL;
