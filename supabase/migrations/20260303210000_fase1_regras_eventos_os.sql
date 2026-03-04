-- Fase 1 (WOW operacional): regras centralizadas + trilha de eventos de OS

CREATE TABLE IF NOT EXISTS public.os_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  evento text NOT NULL,
  severidade text NOT NULL DEFAULT 'info' CHECK (severidade IN ('info', 'warning', 'critical')),
  mensagem text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.os_eventos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'os_eventos' AND policyname = 'os_eventos_empresa'
  ) THEN
    CREATE POLICY "os_eventos_empresa" ON public.os_eventos
      USING (empresa_id = public.minha_empresa_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'os_eventos' AND policyname = 'os_eventos_insert'
  ) THEN
    CREATE POLICY "os_eventos_insert" ON public.os_eventos
      FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_os_eventos_os_created_at
  ON public.os_eventos(ordem_servico_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_os_eventos_empresa_created_at
  ON public.os_eventos(empresa_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_os_evento(
  p_empresa_id uuid,
  p_os_id uuid,
  p_motorista_id uuid,
  p_evento text,
  p_severidade text,
  p_mensagem text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.os_eventos (
    empresa_id,
    ordem_servico_id,
    motorista_id,
    evento,
    severidade,
    mensagem,
    meta
  ) VALUES (
    p_empresa_id,
    p_os_id,
    p_motorista_id,
    p_evento,
    COALESCE(NULLIF(p_severidade, ''), 'info'),
    p_mensagem,
    COALESCE(p_meta, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_os_business_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
  v_is_running_new boolean := v_new_status IN ('em_andamento', 'em_execucao');
  v_is_running_old boolean := v_old_status IN ('em_andamento', 'em_execucao');
  v_data_servico date;
BEGIN
  -- Regra 1: não iniciar/retomar OS futura
  IF v_is_running_new AND NOT v_is_running_old THEN
    BEGIN
      v_data_servico := NULLIF(to_jsonb(NEW)->>'data_servico', '')::date;
    EXCEPTION WHEN others THEN
      v_data_servico := NULL;
    END;

    IF v_data_servico IS NOT NULL AND v_data_servico > CURRENT_DATE THEN
      RAISE EXCEPTION 'Ação não permitida: não é possível iniciar OS futura.';
    END IF;

    -- Regra 2: não permitir duas OS em andamento para o mesmo motorista
    IF NEW.motorista_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM public.ordens_servico os
        WHERE os.motorista_id = NEW.motorista_id
          AND os.id <> NEW.id
          AND lower(COALESCE(os.status, '')) IN ('em_andamento', 'em_execucao')
      ) THEN
        RAISE EXCEPTION 'Ação não permitida: já existe outra OS em andamento para este motorista.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_enforce_business_rules ON public.ordens_servico;
CREATE TRIGGER trg_os_enforce_business_rules
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_os_business_rules();

CREATE OR REPLACE FUNCTION public.trg_log_os_eventos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status text := lower(COALESCE(OLD.status, ''));
  v_new_status text := lower(COALESCE(NEW.status, ''));
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_os_evento(
      NEW.empresa_id,
      NEW.id,
      NEW.motorista_id,
      'os_criada',
      'info',
      'OS criada',
      jsonb_build_object('status', NEW.status, 'numero', NEW.numero)
    );
    RETURN NEW;
  END IF;

  IF v_old_status IS DISTINCT FROM v_new_status THEN
    PERFORM public.log_os_evento(
      NEW.empresa_id,
      NEW.id,
      NEW.motorista_id,
      'status_alterado',
      CASE
        WHEN v_new_status IN ('cancelada') THEN 'warning'
        WHEN v_new_status IN ('concluida', 'finalizada') THEN 'info'
        ELSE 'info'
      END,
      format('Status alterado: %s → %s', COALESCE(OLD.status, '—'), COALESCE(NEW.status, '—')),
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;

  IF (to_jsonb(OLD)->>'km_inicio') IS DISTINCT FROM (to_jsonb(NEW)->>'km_inicio')
     OR (to_jsonb(OLD)->>'km_fim') IS DISTINCT FROM (to_jsonb(NEW)->>'km_fim')
     OR (to_jsonb(OLD)->>'km_inicial') IS DISTINCT FROM (to_jsonb(NEW)->>'km_inicial')
     OR (to_jsonb(OLD)->>'km_final') IS DISTINCT FROM (to_jsonb(NEW)->>'km_final') THEN
    PERFORM public.log_os_evento(
      NEW.empresa_id,
      NEW.id,
      NEW.motorista_id,
      'km_atualizado',
      'info',
      'Hodômetro atualizado na OS',
      jsonb_build_object(
        'km_inicio', to_jsonb(NEW)->>'km_inicio',
        'km_fim', to_jsonb(NEW)->>'km_fim',
        'km_inicial', to_jsonb(NEW)->>'km_inicial',
        'km_final', to_jsonb(NEW)->>'km_final'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_os_log_eventos_insert ON public.ordens_servico;
CREATE TRIGGER trg_os_log_eventos_insert
  AFTER INSERT ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_os_eventos();

DROP TRIGGER IF EXISTS trg_os_log_eventos_update ON public.ordens_servico;
CREATE TRIGGER trg_os_log_eventos_update
  AFTER UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_os_eventos();
