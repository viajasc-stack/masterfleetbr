-- Tokens de push por motorista (Expo)

CREATE TABLE IF NOT EXISTS public.motorista_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id uuid NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE,
  plataforma text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_motorista_push_tokens_motorista
  ON public.motorista_push_tokens(motorista_id);

CREATE INDEX IF NOT EXISTS idx_motorista_push_tokens_empresa_ativo
  ON public.motorista_push_tokens(empresa_id, ativo);

ALTER TABLE public.motorista_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "motorista_push_tokens_empresa" ON public.motorista_push_tokens;
CREATE POLICY "motorista_push_tokens_empresa"
ON public.motorista_push_tokens
USING (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS "motorista_push_tokens_insert" ON public.motorista_push_tokens;
CREATE POLICY "motorista_push_tokens_insert"
ON public.motorista_push_tokens
FOR INSERT
WITH CHECK (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS "motorista_push_tokens_update" ON public.motorista_push_tokens;
CREATE POLICY "motorista_push_tokens_update"
ON public.motorista_push_tokens
FOR UPDATE
USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_motorista_push_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_motorista_push_tokens_empresa ON public.motorista_push_tokens;
CREATE TRIGGER trg_motorista_push_tokens_empresa
  BEFORE INSERT OR UPDATE ON public.motorista_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_motorista_push_tokens();
