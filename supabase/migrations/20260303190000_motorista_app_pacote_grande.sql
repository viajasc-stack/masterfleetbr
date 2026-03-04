-- Pacote grande: estruturas complementares para App Motorista

-- 1) Motoristas: permissões e papel no app
ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS pode_abastecer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'motorista'
    CHECK (role IN ('motorista', 'admin', 'dono')),
  ADD COLUMN IF NOT EXISTS foto_url text;

CREATE INDEX IF NOT EXISTS idx_motoristas_role ON public.motoristas(empresa_id, role);

-- 2) Abastecimentos: registro definitivo (empresa/posto/solicitação)
CREATE TABLE IF NOT EXISTS public.abastecimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'registro' CHECK (tipo IN ('registro','solicitacao')),
  origem_abastecimento text NOT NULL DEFAULT 'empresa' CHECK (origem_abastecimento IN ('empresa','posto','solicitacao')),
  km numeric,
  litros numeric,
  valor numeric,
  cupom_url text,
  observacao text,
  status text NOT NULL DEFAULT 'enviado'
    CHECK (status IN ('enviado','visto','aprovado','negado','concluido','cancelado')),
  aprovado_por uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abastecimentos_empresa" ON public.abastecimentos
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "abastecimentos_insert" ON public.abastecimentos
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "abastecimentos_update" ON public.abastecimentos
  FOR UPDATE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_abastecimentos()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_abastecimentos_empresa ON public.abastecimentos;
CREATE TRIGGER trg_abastecimentos_empresa
  BEFORE INSERT OR UPDATE ON public.abastecimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_abastecimentos();

CREATE INDEX IF NOT EXISTS idx_abastecimentos_empresa_status ON public.abastecimentos(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_motorista ON public.abastecimentos(motorista_id, created_at DESC);

-- 3) Preferências de notificações por motorista
CREATE TABLE IF NOT EXISTS public.motorista_notificacao_preferencias (
  motorista_id uuid PRIMARY KEY REFERENCES public.motoristas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nova_os boolean NOT NULL DEFAULT true,
  alteracao_os boolean NOT NULL DEFAULT true,
  manutencao boolean NOT NULL DEFAULT true,
  abastecimento boolean NOT NULL DEFAULT true,
  mensagens boolean NOT NULL DEFAULT true,
  alertas_sistema boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.motorista_notificacao_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pref_notif_motorista_empresa" ON public.motorista_notificacao_preferencias
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "pref_notif_motorista_insert" ON public.motorista_notificacao_preferencias
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "pref_notif_motorista_update" ON public.motorista_notificacao_preferencias
  FOR UPDATE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_pref_notif_motorista()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pref_notif_motorista_empresa ON public.motorista_notificacao_preferencias;
CREATE TRIGGER trg_pref_notif_motorista_empresa
  BEFORE INSERT OR UPDATE ON public.motorista_notificacao_preferencias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_pref_notif_motorista();

-- 4) Financeiro do motorista (extras)
CREATE TABLE IF NOT EXISTS public.motorista_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES public.motoristas(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('extra_os','ajuste','bonus','desconto')),
  descricao text,
  valor numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  competencia date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.motorista_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "motorista_extras_empresa" ON public.motorista_extras
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "motorista_extras_insert" ON public.motorista_extras
  FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "motorista_extras_update" ON public.motorista_extras
  FOR UPDATE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_motorista_extras()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.empresa_id := COALESCE(NEW.empresa_id, public.minha_empresa_id());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_motorista_extras_empresa ON public.motorista_extras;
CREATE TRIGGER trg_motorista_extras_empresa
  BEFORE INSERT ON public.motorista_extras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_motorista_extras();

CREATE INDEX IF NOT EXISTS idx_motorista_extras_motorista_competencia
  ON public.motorista_extras(motorista_id, competencia DESC);
