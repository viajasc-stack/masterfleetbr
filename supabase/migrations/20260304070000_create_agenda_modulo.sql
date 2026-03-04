-- Módulo Agenda: compromissos manuais e feriados editáveis por empresa

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data date NOT NULL,
  horario time,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'outro' CHECK (tipo IN ('reuniao', 'outro', 'lembrete')),
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agenda_feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data date NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#fef3c7',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, data, nome)
);

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_eventos_empresa"
  ON public.agenda_eventos
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "agenda_eventos_insert"
  ON public.agenda_eventos
  FOR INSERT
  WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "agenda_eventos_update"
  ON public.agenda_eventos
  FOR UPDATE
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "agenda_eventos_delete"
  ON public.agenda_eventos
  FOR DELETE
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "agenda_feriados_empresa"
  ON public.agenda_feriados
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "agenda_feriados_insert"
  ON public.agenda_feriados
  FOR INSERT
  WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "agenda_feriados_update"
  ON public.agenda_feriados
  FOR UPDATE
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "agenda_feriados_delete"
  ON public.agenda_feriados
  FOR DELETE
  USING (empresa_id = public.minha_empresa_id());

CREATE INDEX IF NOT EXISTS idx_agenda_eventos_empresa_data
  ON public.agenda_eventos(empresa_id, data);

CREATE INDEX IF NOT EXISTS idx_agenda_feriados_empresa_data
  ON public.agenda_feriados(empresa_id, data);
