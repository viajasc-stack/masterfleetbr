-- Hotfix: master_operacoes_dashboard precisa funcionar mesmo sem notifications_audit

CREATE OR REPLACE FUNCTION public.master_operacoes_dashboard(
  p_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_logs jsonb := '[]'::jsonb;
  v_audits jsonb := '[]'::jsonb;
  v_limit int := GREATEST(COALESCE(p_limit, 100), 1);
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF to_regclass('public.webhook_logs') IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'source', x.source,
          'created_at', x.created_at
        )
        ORDER BY x.created_at DESC
      ),
      '[]'::jsonb
    )
    INTO v_logs
    FROM (
      SELECT wl.id, wl.source, wl.created_at
      FROM public.webhook_logs wl
      ORDER BY wl.created_at DESC
      LIMIT v_limit
    ) x;
  END IF;

  IF to_regclass('public.notifications_audit') IS NOT NULL THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', y.id,
          'action', y.action,
          'created_at', y.created_at
        )
        ORDER BY y.created_at DESC
      ),
      '[]'::jsonb
    )
    INTO v_audits
    FROM (
      SELECT na.id, na.action, na.created_at
      FROM public.notifications_audit na
      ORDER BY na.created_at DESC
      LIMIT v_limit
    ) y;
  END IF;

  RETURN jsonb_build_object(
    'logs', v_logs,
    'audits', v_audits
  );
END;
$$;
