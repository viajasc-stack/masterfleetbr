-- =============================================================================
-- MasterFleetBR - Schema inicial (execute após deletar as tabelas)
-- Execute no SQL Editor do Supabase
-- =============================================================================

-- 1) Empresas
CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2) Planos (para assinaturas futuras)
CREATE TABLE IF NOT EXISTS public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor_centavos bigint DEFAULT 0,
  ativo boolean DEFAULT true,
  ordem int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3) Assinaturas (trial, ativa, bloqueada, etc.)
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  plano_id uuid REFERENCES public.planos(id),
  status text DEFAULT 'trial' CHECK (status IN ('trial', 'ativa', 'past_due', 'bloqueada', 'cancelada')),
  trial_ate timestamptz,
  proxima_cobranca timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 4) Profiles (vincula usuário auth à empresa e role)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text,
  role text DEFAULT 'admin' CHECK (role IN ('dono', 'admin', 'motorista'))
);

-- 5) RLS - cada empresa só vê seus dados
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário só acessa dados da sua empresa
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "empresas_select_via_profile" ON public.empresas
  FOR SELECT USING (
    id IN (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "empresas_insert" ON public.empresas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "assinaturas_select_via_empresa" ON public.assinaturas
  FOR SELECT USING (
    empresa_id IN (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "assinaturas_insert" ON public.assinaturas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "planos_select_all" ON public.planos
  FOR SELECT USING (true);

-- 6) RPC: criar empresa + profile + assinatura (trial 7 dias)
CREATE OR REPLACE FUNCTION public.criar_empresa_e_profile(
  p_nome_empresa text,
  p_nome_usuario text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_plano_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Cria empresa
  INSERT INTO public.empresas (nome) VALUES (p_nome_empresa)
  RETURNING id INTO v_empresa_id;

  -- Pega primeiro plano ativo (ou null)
  SELECT id INTO v_plano_id FROM public.planos WHERE ativo = true ORDER BY ordem LIMIT 1;

  -- Cria assinatura trial 7 dias
  INSERT INTO public.assinaturas (empresa_id, plano_id, status, trial_ate)
  VALUES (
    v_empresa_id,
    v_plano_id,
    'trial',
    now() + interval '7 days'
  );

  -- Cria profile (admin da empresa)
  INSERT INTO public.profiles (user_id, empresa_id, nome, role)
  VALUES (v_user_id, v_empresa_id, p_nome_usuario, 'admin');

  RETURN v_empresa_id;
END;
$$;
