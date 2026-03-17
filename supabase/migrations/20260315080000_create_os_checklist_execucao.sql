-- Fase 4.3 (base): checklist operacional por OS

CREATE TABLE IF NOT EXISTS public.os_checklist_execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  etapa text NOT NULL CHECK (etapa IN ('pre_partida', 'embarque', 'pos_servico')),
  item_codigo text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  atualizado_por_motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ordem_servico_id, etapa, item_codigo)
);

ALTER TABLE public.os_checklist_execucao ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'os_checklist_execucao' AND policyname = 'os_checklist_execucao_empresa'
  ) THEN
    CREATE POLICY "os_checklist_execucao_empresa" ON public.os_checklist_execucao
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'os_checklist_execucao' AND policyname = 'os_checklist_execucao_insert'
  ) THEN
    CREATE POLICY "os_checklist_execucao_insert" ON public.os_checklist_execucao
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'os_checklist_execucao' AND policyname = 'os_checklist_execucao_update'
  ) THEN
    CREATE POLICY "os_checklist_execucao_update" ON public.os_checklist_execucao
      FOR UPDATE USING (empresa_id = public.minha_empresa_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_os_checklist_execucao_os
  ON public.os_checklist_execucao (ordem_servico_id, etapa, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_empresa_id_os_checklist_execucao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    SELECT os.empresa_id INTO NEW.empresa_id
    FROM public.ordens_servico os
    WHERE os.id = NEW.ordem_servico_id;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_checklist_execucao_empresa ON public.os_checklist_execucao;
CREATE TRIGGER trg_os_checklist_execucao_empresa
  BEFORE INSERT OR UPDATE ON public.os_checklist_execucao
  FOR EACH ROW
  EXECUTE FUNCTION public.set_empresa_id_os_checklist_execucao();
