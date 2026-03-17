-- Configuração de checklist operacional por empresa (admin web -> app motorista)

CREATE TABLE IF NOT EXISTS public.motorista_checklist_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  etapa text NOT NULL CHECK (etapa IN ('pre_partida', 'embarque', 'pos_servico')),
  item_codigo text NOT NULL,
  item_label text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, etapa, item_codigo)
);

ALTER TABLE public.motorista_checklist_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'motorista_checklist_config' AND policyname = 'motorista_checklist_config_empresa'
  ) THEN
    CREATE POLICY "motorista_checklist_config_empresa" ON public.motorista_checklist_config
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'motorista_checklist_config' AND policyname = 'motorista_checklist_config_insert'
  ) THEN
    CREATE POLICY "motorista_checklist_config_insert" ON public.motorista_checklist_config
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'motorista_checklist_config' AND policyname = 'motorista_checklist_config_update'
  ) THEN
    CREATE POLICY "motorista_checklist_config_update" ON public.motorista_checklist_config
      FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_empresa_id_motorista_checklist_config()
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

DROP TRIGGER IF EXISTS trg_motorista_checklist_config_empresa ON public.motorista_checklist_config;
CREATE TRIGGER trg_motorista_checklist_config_empresa
  BEFORE INSERT OR UPDATE ON public.motorista_checklist_config
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_motorista_checklist_config();

CREATE INDEX IF NOT EXISTS idx_motorista_checklist_config_empresa_etapa
  ON public.motorista_checklist_config (empresa_id, etapa, ativo);

-- Seeds padrão para empresas existentes
INSERT INTO public.motorista_checklist_config (empresa_id, etapa, item_codigo, item_label, ativo)
SELECT e.id, i.etapa, i.item_codigo, i.item_label, true
FROM public.empresas e
CROSS JOIN (
  VALUES
    ('pre_partida', 'documentos_ok', 'Documentos conferidos'),
    ('pre_partida', 'veiculo_inspecao', 'Inspeção visual do veículo'),
    ('pre_partida', 'itens_seguranca', 'Itens de segurança validados'),
    ('embarque', 'contagem_passageiros', 'Contagem de passageiros feita'),
    ('embarque', 'itinerario_alinhado', 'Itinerário alinhado com operação'),
    ('embarque', 'saida_registrada', 'Saída registrada no app'),
    ('pos_servico', 'desembarque_ok', 'Desembarque concluído'),
    ('pos_servico', 'vistoria_pos', 'Vistoria pós-operação realizada'),
    ('pos_servico', 'evidencias_finais', 'Evidências finais anexadas')
) AS i(etapa, item_codigo, item_label)
ON CONFLICT (empresa_id, etapa, item_codigo) DO NOTHING;

-- Seeds padrão para novas empresas
CREATE OR REPLACE FUNCTION public.seed_motorista_checklist_config_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.motorista_checklist_config (empresa_id, etapa, item_codigo, item_label, ativo)
  VALUES
    (NEW.id, 'pre_partida', 'documentos_ok', 'Documentos conferidos', true),
    (NEW.id, 'pre_partida', 'veiculo_inspecao', 'Inspeção visual do veículo', true),
    (NEW.id, 'pre_partida', 'itens_seguranca', 'Itens de segurança validados', true),
    (NEW.id, 'embarque', 'contagem_passageiros', 'Contagem de passageiros feita', true),
    (NEW.id, 'embarque', 'itinerario_alinhado', 'Itinerário alinhado com operação', true),
    (NEW.id, 'embarque', 'saida_registrada', 'Saída registrada no app', true),
    (NEW.id, 'pos_servico', 'desembarque_ok', 'Desembarque concluído', true),
    (NEW.id, 'pos_servico', 'vistoria_pos', 'Vistoria pós-operação realizada', true),
    (NEW.id, 'pos_servico', 'evidencias_finais', 'Evidências finais anexadas', true)
  ON CONFLICT (empresa_id, etapa, item_codigo) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_motorista_checklist_config_empresa ON public.empresas;
CREATE TRIGGER trg_seed_motorista_checklist_config_empresa
  AFTER INSERT ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_motorista_checklist_config_empresa();
