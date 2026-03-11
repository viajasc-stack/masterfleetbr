-- Módulo Viagens (Fase 1): cadastro base e operação inicial

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'viagem_status') THEN
    CREATE TYPE public.viagem_status AS ENUM (
      'rascunho',
      'publicada',
      'vendas_abertas',
      'lotada',
      'encerrada',
      'finalizada',
      'cancelada'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'viagem_categoria') THEN
    CREATE TYPE public.viagem_categoria AS ENUM (
      'turismo',
      'compras',
      'religioso',
      'evento',
      'bate_volta',
      'interestadual',
      'outros'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.viagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

  codigo text,
  titulo text NOT NULL,
  categoria public.viagem_categoria NOT NULL DEFAULT 'turismo',
  status public.viagem_status NOT NULL DEFAULT 'rascunho',

  data_ida date NOT NULL,
  hora_saida time,
  data_retorno date,
  hora_retorno_prevista time,

  data_abertura_vendas timestamptz,
  prazo_final_venda_online timestamptz,
  prazo_final_venda_interna timestamptz,
  prazo_cancelamento timestamptz,

  cidade_saida text,
  local_embarque text,
  cidade_destino text,
  roteiro_previsto text,

  valor numeric(12,2) NOT NULL DEFAULT 0,
  valor_promocional numeric(12,2),
  sinal_minimo_reserva numeric(12,2),
  permite_parcelamento boolean NOT NULL DEFAULT false,
  max_parcelas integer,

  capacidade_total integer,
  vendas_ilimitadas boolean NOT NULL DEFAULT false,
  vagas_reservadas_internas integer NOT NULL DEFAULT 0,
  bloquear_ao_atingir_limite boolean NOT NULL DEFAULT true,

  descricao_curta text,
  descricao_completa text,
  inclui text,
  nao_inclui text,
  observacoes text,
  regras text,
  documentos_obrigatorios text,
  politica_cancelamento text,

  imagem_principal_url text,
  banner_url text,
  slug_publico text,
  publicada_em timestamptz,

  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  guia_responsavel text,
  parceiro_nome text,
  os_vinculada_id uuid REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  centro_custo text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT viagens_capacidade_valida CHECK (
    vendas_ilimitadas = true OR (capacidade_total IS NOT NULL AND capacidade_total > 0)
  ),
  CONSTRAINT viagens_datas_validas CHECK (
    data_retorno IS NULL OR data_retorno >= data_ida
  ),
  CONSTRAINT viagens_max_parcelas_valida CHECK (
    max_parcelas IS NULL OR max_parcelas >= 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_viagens_empresa_codigo
  ON public.viagens(empresa_id, codigo)
  WHERE codigo IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_viagens_slug_publico
  ON public.viagens(slug_publico)
  WHERE slug_publico IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_viagens_empresa_status_data
  ON public.viagens(empresa_id, status, data_ida);

CREATE INDEX IF NOT EXISTS idx_viagens_empresa_destino
  ON public.viagens(empresa_id, cidade_destino);

ALTER TABLE public.viagens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'viagens' AND policyname = 'viagens_empresa'
  ) THEN
    CREATE POLICY "viagens_empresa"
      ON public.viagens
      FOR SELECT
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'viagens' AND policyname = 'viagens_insert'
  ) THEN
    CREATE POLICY "viagens_insert"
      ON public.viagens
      FOR INSERT
      WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'viagens' AND policyname = 'viagens_update'
  ) THEN
    CREATE POLICY "viagens_update"
      ON public.viagens
      FOR UPDATE
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'viagens' AND policyname = 'viagens_delete'
  ) THEN
    CREATE POLICY "viagens_delete"
      ON public.viagens
      FOR DELETE
      USING (empresa_id = public.minha_empresa_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_viagens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE(NEW.empresa_id::text, '') = '' THEN
    NEW.empresa_id := public.minha_empresa_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_empresa_id_viagens ON public.viagens;
CREATE TRIGGER trg_set_empresa_id_viagens
  BEFORE INSERT ON public.viagens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_viagens();

CREATE OR REPLACE FUNCTION public.set_updated_at_viagens()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_viagens ON public.viagens;
CREATE TRIGGER trg_set_updated_at_viagens
  BEFORE UPDATE ON public.viagens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_viagens();