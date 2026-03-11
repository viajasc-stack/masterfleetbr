-- Fretamento compartilhado dentro de contratos

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_pagante_contrato_passageiro') THEN
    CREATE TYPE public.tipo_pagante_contrato_passageiro AS ENUM ('PARTICULAR', 'EMPRESA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_cobranca_contrato_passageiro') THEN
    CREATE TYPE public.tipo_cobranca_contrato_passageiro AS ENUM ('DIARIA', 'MENSAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_contrato_passageiro') THEN
    CREATE TYPE public.status_contrato_passageiro AS ENUM ('ATIVO', 'INATIVO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_embarque_presenca') THEN
    CREATE TYPE public.status_embarque_presenca AS ENUM ('PENDENTE', 'EMBARCOU', 'FALTOU', 'EXTRA');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.passageiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  telefone text,
  observacoes text,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contrato_rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  origem text,
  destino text,
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contrato_rota_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_rota_id uuid NOT NULL REFERENCES public.contrato_rotas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  endereco text,
  bairro text,
  cidade text,
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contrato_passageiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  passageiro_id uuid NOT NULL REFERENCES public.passageiros(id) ON DELETE CASCADE,
  data_inicio date,
  data_fim date,
  status public.status_contrato_passageiro NOT NULL DEFAULT 'ATIVO',
  tipo_pagante public.tipo_pagante_contrato_passageiro NOT NULL DEFAULT 'PARTICULAR',
  empresa_pagante_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo_cobranca public.tipo_cobranca_contrato_passageiro NOT NULL DEFAULT 'DIARIA',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrato_passageiros_unq UNIQUE (contrato_id, passageiro_id)
);

CREATE TABLE IF NOT EXISTS public.contrato_passageiro_participacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  contrato_passageiro_id uuid NOT NULL REFERENCES public.contrato_passageiros(id) ON DELETE CASCADE,
  contrato_rota_id uuid NOT NULL REFERENCES public.contrato_rotas(id) ON DELETE CASCADE,
  contrato_horario_id uuid REFERENCES public.contrato_horarios(id) ON DELETE SET NULL,
  ponto_embarque_id uuid NOT NULL REFERENCES public.contrato_rota_pontos(id) ON DELETE RESTRICT,
  ponto_desembarque_id uuid NOT NULL REFERENCES public.contrato_rota_pontos(id) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.os_passageiros_presenca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  passageiro_id uuid NOT NULL REFERENCES public.passageiros(id) ON DELETE CASCADE,
  contrato_passageiro_id uuid REFERENCES public.contrato_passageiros(id) ON DELETE SET NULL,
  status public.status_embarque_presenca NOT NULL DEFAULT 'PENDENTE',
  hora_registro timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT os_passageiros_presenca_unq UNIQUE (os_id, passageiro_id)
);

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS contrato_rota_id uuid REFERENCES public.contrato_rotas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contrato_horario_id uuid REFERENCES public.contrato_horarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contrato_rotas_contrato ON public.contrato_rotas(empresa_id, contrato_id, ativo);
CREATE INDEX IF NOT EXISTS idx_contrato_rota_pontos_rota ON public.contrato_rota_pontos(empresa_id, contrato_rota_id, ordem);
CREATE INDEX IF NOT EXISTS idx_contrato_passageiros_contrato ON public.contrato_passageiros(empresa_id, contrato_id, status);
CREATE INDEX IF NOT EXISTS idx_contrato_passageiro_participacoes_cp ON public.contrato_passageiro_participacoes(empresa_id, contrato_passageiro_id, ativo);
CREATE INDEX IF NOT EXISTS idx_os_passageiros_presenca_os ON public.os_passageiros_presenca(empresa_id, os_id, status);

ALTER TABLE public.passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_rota_pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrato_passageiro_participacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_passageiros_presenca ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'passageiros','contrato_rotas','contrato_rota_pontos','contrato_passageiros','contrato_passageiro_participacoes','os_passageiros_presenca'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_empresa ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_empresa ON public.%I USING (empresa_id = public.minha_empresa_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE USING (empresa_id = public.minha_empresa_id())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE USING (empresa_id = public.minha_empresa_id())', t, t);
  END LOOP;
END$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_passageiros_updated_at ON public.passageiros;
CREATE TRIGGER trg_passageiros_updated_at BEFORE UPDATE ON public.passageiros FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
DROP TRIGGER IF EXISTS trg_contrato_rotas_updated_at ON public.contrato_rotas;
CREATE TRIGGER trg_contrato_rotas_updated_at BEFORE UPDATE ON public.contrato_rotas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
DROP TRIGGER IF EXISTS trg_contrato_rota_pontos_updated_at ON public.contrato_rota_pontos;
CREATE TRIGGER trg_contrato_rota_pontos_updated_at BEFORE UPDATE ON public.contrato_rota_pontos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
DROP TRIGGER IF EXISTS trg_contrato_passageiros_updated_at ON public.contrato_passageiros;
CREATE TRIGGER trg_contrato_passageiros_updated_at BEFORE UPDATE ON public.contrato_passageiros FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
DROP TRIGGER IF EXISTS trg_contrato_passageiro_participacoes_updated_at ON public.contrato_passageiro_participacoes;
CREATE TRIGGER trg_contrato_passageiro_participacoes_updated_at BEFORE UPDATE ON public.contrato_passageiro_participacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
DROP TRIGGER IF EXISTS trg_os_passageiros_presenca_updated_at ON public.os_passageiros_presenca;
CREATE TRIGGER trg_os_passageiros_presenca_updated_at BEFORE UPDATE ON public.os_passageiros_presenca FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
