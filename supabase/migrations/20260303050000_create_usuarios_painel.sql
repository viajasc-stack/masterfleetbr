-- Usuários do painel (acesso web por e-mail/senha)

-- Permite novo papel de usuário interno
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('dono', 'admin', 'motorista', 'usuario'));

CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Identificação
  nome text NOT NULL,
  apelido text,
  cpf text,
  rg text,
  data_nascimento date,

  -- Contato
  email text,
  telefone text,
  whatsapp text,

  -- Endereço
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,

  -- Operacional
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'ferias', 'afastado', 'inativo')),
  data_admissao date,
  data_demissao date,

  -- Financeiro
  chave_pix text,
  banco text,
  agencia text,
  conta text,

  observacoes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_empresa" ON public.usuarios
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "usuarios_insert" ON public.usuarios
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "usuarios_update" ON public.usuarios
  FOR UPDATE USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "usuarios_delete" ON public.usuarios
  FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_usuarios()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF COALESCE(NEW.empresa_id::text, '') = '' THEN
    NEW.empresa_id := public.minha_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_empresa
  BEFORE INSERT ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_usuarios();

CREATE OR REPLACE FUNCTION public.set_updated_at_usuarios()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_usuarios();

CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON public.usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(empresa_id, email);