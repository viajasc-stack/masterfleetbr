-- MasterIA: base de alertas, conversas e função de detecção de conflito de OS

CREATE TABLE IF NOT EXISTS public.masteria_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  descricao text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aberto',
  origem text NOT NULL DEFAULT 'sistema',
  detectado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_masteria_alertas_empresa_status
  ON public.masteria_alertas (empresa_id, status, detectado_em DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_masteria_alerta_conflito_assinatura_aberto
  ON public.masteria_alertas (empresa_id, tipo, ((meta->>'signature')))
  WHERE status = 'aberto' AND tipo = 'conflito_veiculo_os';

CREATE TABLE IF NOT EXISTS public.masteria_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  criado_por uuid,
  titulo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_masteria_conversas_empresa_created
  ON public.masteria_conversas (empresa_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.masteria_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.masteria_conversas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  autor_tipo text NOT NULL,
  conteudo text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_masteria_mensagens_conversa_created
  ON public.masteria_mensagens (conversa_id, created_at);

ALTER TABLE public.masteria_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masteria_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masteria_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS masteria_alertas_select ON public.masteria_alertas;
CREATE POLICY masteria_alertas_select ON public.masteria_alertas
FOR SELECT
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_alertas_insert ON public.masteria_alertas;
CREATE POLICY masteria_alertas_insert ON public.masteria_alertas
FOR INSERT
WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_alertas_update ON public.masteria_alertas;
CREATE POLICY masteria_alertas_update ON public.masteria_alertas
FOR UPDATE
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())
WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_conversas_select ON public.masteria_conversas;
CREATE POLICY masteria_conversas_select ON public.masteria_conversas
FOR SELECT
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_conversas_insert ON public.masteria_conversas;
CREATE POLICY masteria_conversas_insert ON public.masteria_conversas
FOR INSERT
WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_conversas_update ON public.masteria_conversas;
CREATE POLICY masteria_conversas_update ON public.masteria_conversas
FOR UPDATE
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())
WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_mensagens_select ON public.masteria_mensagens;
CREATE POLICY masteria_mensagens_select ON public.masteria_mensagens
FOR SELECT
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_mensagens_insert ON public.masteria_mensagens;
CREATE POLICY masteria_mensagens_insert ON public.masteria_mensagens
FOR INSERT
WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

DROP POLICY IF EXISTS masteria_mensagens_update ON public.masteria_mensagens;
CREATE POLICY masteria_mensagens_update ON public.masteria_mensagens
FOR UPDATE
USING (empresa_id = public.minha_empresa_id() OR public.is_super_admin())
WITH CHECK (empresa_id = public.minha_empresa_id() OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.masteria_list_os_conflicts(
  p_empresa_id uuid DEFAULT NULL,
  p_days_ahead integer DEFAULT 7
)
RETURNS TABLE (
  empresa_id uuid,
  veiculo_id uuid,
  os_id_1 uuid,
  os_numero_1 integer,
  os_inicio_1 timestamptz,
  os_fim_1 timestamptz,
  os_id_2 uuid,
  os_numero_2 integer,
  os_inicio_2 timestamptz,
  os_fim_2 timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT CASE
      WHEN p_empresa_id IS NOT NULL AND public.is_super_admin() THEN p_empresa_id
      ELSE public.minha_empresa_id()
    END AS empresa_id
  ),
  base AS (
    SELECT
      o.id,
      o.empresa_id,
      o.veiculo_id,
      o.numero,
      COALESCE(o.inicio_em, o.created_at) AS inicio_real,
      COALESCE(o.fim_em, COALESCE(o.inicio_em, o.created_at) + interval '1 hour') AS fim_real
    FROM public.ordens_servico o
    INNER JOIN scope s ON s.empresa_id = o.empresa_id
    WHERE o.veiculo_id IS NOT NULL
      AND LOWER(COALESCE(o.status, '')) IN ('pendente', 'em_execucao', 'em_andamento', 'pausada', 'pausado')
      AND COALESCE(o.inicio_em, o.created_at) <= now() + make_interval(days => GREATEST(0, COALESCE(p_days_ahead, 7)))
      AND COALESCE(o.fim_em, COALESCE(o.inicio_em, o.created_at) + interval '1 hour') >= now() - interval '1 day'
  )
  SELECT
    b1.empresa_id,
    b1.veiculo_id,
    b1.id AS os_id_1,
    b1.numero AS os_numero_1,
    b1.inicio_real AS os_inicio_1,
    b1.fim_real AS os_fim_1,
    b2.id AS os_id_2,
    b2.numero AS os_numero_2,
    b2.inicio_real AS os_inicio_2,
    b2.fim_real AS os_fim_2
  FROM base b1
  INNER JOIN base b2
    ON b1.veiculo_id = b2.veiculo_id
   AND b1.id < b2.id
   AND b1.inicio_real < b2.fim_real
   AND b2.inicio_real < b1.fim_real
  ORDER BY b1.inicio_real ASC;
$$;

CREATE OR REPLACE FUNCTION public.masteria_mark_alert_resolved(
  p_alerta_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
BEGIN
  UPDATE public.masteria_alertas
  SET
    status = 'resolvido',
    resolvido_em = now(),
    resolvido_por = auth.uid(),
    updated_at = now()
  WHERE id = p_alerta_id
    AND (empresa_id = v_empresa_id OR public.is_super_admin())
    AND status <> 'resolvido';

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.masteria_list_os_conflicts(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.masteria_mark_alert_resolved(uuid) TO authenticated;
