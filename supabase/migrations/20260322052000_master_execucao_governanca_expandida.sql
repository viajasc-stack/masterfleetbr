-- Expansão do painel master: saúde, auditoria, risco, CRM, comunicação, rollout,
-- cobrança avançada, data room, base de conhecimento, LGPD e onboarding score.

CREATE TABLE IF NOT EXISTS public.master_empresa_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_account_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'trial',
  owner text NULL,
  next_action text NULL,
  notes text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  segment jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels jsonb NOT NULL DEFAULT '["in_app"]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_release_rollouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_code text NOT NULL,
  target_segment jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollout_percent int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_billing_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fatura_id uuid NULL,
  status text NOT NULL DEFAULT 'aberta',
  acordo_valor_centavos bigint NOT NULL DEFAULT 0,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_support_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  status text NOT NULL DEFAULT 'aberta',
  detalhes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_onboarding_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'inicial',
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.master_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_master_account_pipeline_updated_at ON public.master_account_pipeline;
CREATE TRIGGER trg_master_account_pipeline_updated_at
BEFORE UPDATE ON public.master_account_pipeline
FOR EACH ROW EXECUTE FUNCTION public.master_touch_updated_at();

DROP TRIGGER IF EXISTS trg_master_release_rollouts_updated_at ON public.master_release_rollouts;
CREATE TRIGGER trg_master_release_rollouts_updated_at
BEFORE UPDATE ON public.master_release_rollouts
FOR EACH ROW EXECUTE FUNCTION public.master_touch_updated_at();

DROP TRIGGER IF EXISTS trg_master_billing_negotiations_updated_at ON public.master_billing_negotiations;
CREATE TRIGGER trg_master_billing_negotiations_updated_at
BEFORE UPDATE ON public.master_billing_negotiations
FOR EACH ROW EXECUTE FUNCTION public.master_touch_updated_at();

DROP TRIGGER IF EXISTS trg_master_kb_articles_updated_at ON public.master_kb_articles;
CREATE TRIGGER trg_master_kb_articles_updated_at
BEFORE UPDATE ON public.master_kb_articles
FOR EACH ROW EXECUTE FUNCTION public.master_touch_updated_at();

DROP TRIGGER IF EXISTS trg_master_support_macros_updated_at ON public.master_support_macros;
CREATE TRIGGER trg_master_support_macros_updated_at
BEFORE UPDATE ON public.master_support_macros
FOR EACH ROW EXECUTE FUNCTION public.master_touch_updated_at();

DROP TRIGGER IF EXISTS trg_master_lgpd_requests_updated_at ON public.master_lgpd_requests;
CREATE TRIGGER trg_master_lgpd_requests_updated_at
BEFORE UPDATE ON public.master_lgpd_requests
FOR EACH ROW EXECUTE FUNCTION public.master_touch_updated_at();

DROP TRIGGER IF EXISTS trg_master_onboarding_scores_updated_at ON public.master_onboarding_scores;
CREATE TRIGGER trg_master_onboarding_scores_updated_at
BEFORE UPDATE ON public.master_onboarding_scores
FOR EACH ROW EXECUTE FUNCTION public.master_touch_updated_at();

ALTER TABLE public.master_empresa_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_account_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_release_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_billing_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_support_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_lgpd_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_onboarding_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS master_empresa_audit_log_master_select ON public.master_empresa_audit_log;
CREATE POLICY master_empresa_audit_log_master_select ON public.master_empresa_audit_log
FOR SELECT USING (public.is_super_admin());
DROP POLICY IF EXISTS master_empresa_audit_log_master_insert ON public.master_empresa_audit_log;
CREATE POLICY master_empresa_audit_log_master_insert ON public.master_empresa_audit_log
FOR INSERT WITH CHECK (public.is_super_admin());

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'master_account_pipeline',
    'master_broadcasts',
    'master_release_rollouts',
    'master_billing_negotiations',
    'master_kb_articles',
    'master_support_macros',
    'master_lgpd_requests',
    'master_onboarding_scores'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_master_select ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_master_select ON public.%I FOR SELECT USING (public.is_super_admin())', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_master_write ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY %I_master_write ON public.%I FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())', tbl, tbl);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.master_platform_health(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := GREATEST(COALESCE(p_limit, 100), 1);
  v_now timestamptz := now();
  v_webhooks_24h int := 0;
  v_audits_24h int := 0;
  v_support_abertos int := 0;
  v_support_criticos int := 0;
  v_faturas_vencidas int := 0;
  v_logs jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COUNT(*) INTO v_webhooks_24h
  FROM public.webhook_logs wl
  WHERE wl.created_at >= v_now - interval '24 hours';

  SELECT COUNT(*) INTO v_audits_24h
  FROM public.notifications_audit na
  WHERE na.created_at >= v_now - interval '24 hours';

  SELECT COUNT(*) INTO v_support_abertos
  FROM public.support_tickets st
  WHERE st.status IN ('aberto', 'em_andamento', 'aguardando_cliente');

  SELECT COUNT(*) INTO v_support_criticos
  FROM public.support_tickets st
  WHERE st.status IN ('aberto', 'em_andamento') AND st.prioridade = 'critica';

  SELECT COUNT(*) INTO v_faturas_vencidas
  FROM public.faturas f
  WHERE f.status = 'aberta' AND f.vencimento IS NOT NULL AND f.vencimento < v_now;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('source', x.source, 'created_at', x.created_at) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_logs
  FROM (
    SELECT wl.source, wl.created_at
    FROM public.webhook_logs wl
    ORDER BY wl.created_at DESC
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object(
    'webhooks_24h', v_webhooks_24h,
    'audits_24h', v_audits_24h,
    'support_abertos', v_support_abertos,
    'support_criticos', v_support_criticos,
    'faturas_vencidas', v_faturas_vencidas,
    'recent_logs', v_logs
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.master_bulk_empresa_action(
  p_ids uuid[],
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count int := 0;
  v_actor uuid := auth.uid();
  v_latest_assinatura uuid;
  v_plano_id uuid;
  v_coupon_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_plano_id := NULLIF(p_payload->>'plano_id', '')::uuid;
  v_coupon_id := NULLIF(p_payload->>'coupon_id', '')::uuid;

  FOREACH v_id IN ARRAY p_ids LOOP
    IF p_action = 'bloquear' THEN
      UPDATE public.assinaturas a
      SET status = 'bloqueada'
      WHERE a.id = (
        SELECT ax.id FROM public.assinaturas ax
        WHERE ax.empresa_id = v_id
        ORDER BY ax.created_at DESC
        LIMIT 1
      );
      v_count := v_count + 1;
    ELSIF p_action = 'ativar' THEN
      UPDATE public.assinaturas a
      SET status = 'ativa'
      WHERE a.id = (
        SELECT ax.id FROM public.assinaturas ax
        WHERE ax.empresa_id = v_id
        ORDER BY ax.created_at DESC
        LIMIT 1
      );
      v_count := v_count + 1;
    ELSIF p_action = 'trial_plus_7' THEN
      UPDATE public.assinaturas a
      SET trial_ate = COALESCE(a.trial_ate, now()) + interval '7 days'
      WHERE a.id = (
        SELECT ax.id FROM public.assinaturas ax
        WHERE ax.empresa_id = v_id
        ORDER BY ax.created_at DESC
        LIMIT 1
      );
      v_count := v_count + 1;
    ELSIF p_action = 'trocar_plano' AND v_plano_id IS NOT NULL THEN
      UPDATE public.assinaturas a
      SET plano_id = v_plano_id
      WHERE a.id = (
        SELECT ax.id FROM public.assinaturas ax
        WHERE ax.empresa_id = v_id
        ORDER BY ax.created_at DESC
        LIMIT 1
      );
      v_count := v_count + 1;
    ELSIF p_action = 'aplicar_cupom' AND v_coupon_id IS NOT NULL THEN
      PERFORM public.master_apply_billing_coupon_to_empresa(v_coupon_id, v_id, NULL, 'aplicacao_em_massa_master');
      v_count := v_count + 1;
    END IF;

    INSERT INTO public.master_empresa_audit_log (empresa_id, action, payload, actor_user_id)
    VALUES (v_id, p_action, COALESCE(p_payload, '{}'::jsonb), v_actor);
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_empresa_audit(
  p_empresa_id uuid DEFAULT NULL,
  p_limit int DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  empresa_nome text,
  action text,
  payload jsonb,
  actor_user_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT l.id, l.empresa_id, e.nome, l.action, l.payload, l.actor_user_id, l.created_at
  FROM public.master_empresa_audit_log l
  JOIN public.empresas e ON e.id = l.empresa_id
  WHERE p_empresa_id IS NULL OR l.empresa_id = p_empresa_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 300), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.master_risco_empresas(p_limit int DEFAULT 200)
RETURNS TABLE (
  empresa_id uuid,
  empresa_nome text,
  score int,
  status_assinatura text,
  faturas_vencidas int,
  tickets_abertos int,
  tickets_criticos int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_assinatura AS (
    SELECT DISTINCT ON (a.empresa_id)
      a.empresa_id,
      a.status
    FROM public.assinaturas a
    ORDER BY a.empresa_id, a.created_at DESC
  ),
  vencidas AS (
    SELECT f.empresa_id, COUNT(*)::int AS qtd
    FROM public.faturas f
    WHERE f.status = 'aberta' AND f.vencimento IS NOT NULL AND f.vencimento < now()
    GROUP BY f.empresa_id
  ),
  tickets AS (
    SELECT
      st.empresa_id,
      COUNT(*) FILTER (WHERE st.status IN ('aberto', 'em_andamento', 'aguardando_cliente'))::int AS abertos,
      COUNT(*) FILTER (WHERE st.status IN ('aberto', 'em_andamento') AND st.prioridade = 'critica')::int AS criticos
    FROM public.support_tickets st
    GROUP BY st.empresa_id
  )
  SELECT
    e.id,
    e.nome,
    (
      CASE
        WHEN la.status = 'past_due' THEN 35
        WHEN la.status = 'bloqueada' THEN 45
        ELSE 5
      END
      + COALESCE(v.qtd, 0) * 12
      + COALESCE(t.abertos, 0) * 6
      + COALESCE(t.criticos, 0) * 15
    )::int AS score,
    COALESCE(la.status, 'sem_assinatura') AS status_assinatura,
    COALESCE(v.qtd, 0) AS faturas_vencidas,
    COALESCE(t.abertos, 0) AS tickets_abertos,
    COALESCE(t.criticos, 0) AS tickets_criticos
  FROM public.empresas e
  LEFT JOIN latest_assinatura la ON la.empresa_id = e.id
  LEFT JOIN vencidas v ON v.empresa_id = e.id
  LEFT JOIN tickets t ON t.empresa_id = e.id
  ORDER BY score DESC, e.nome
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
$$;

CREATE OR REPLACE FUNCTION public.master_list_pipeline()
RETURNS TABLE (id uuid, empresa_id uuid, empresa_nome text, stage text, owner text, next_action text, notes text, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.empresa_id, e.nome, p.stage, p.owner, p.next_action, p.notes, p.updated_at
  FROM public.master_account_pipeline p
  JOIN public.empresas e ON e.id = p.empresa_id
  ORDER BY p.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_pipeline(
  p_empresa_id uuid,
  p_stage text,
  p_owner text DEFAULT NULL,
  p_next_action text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.master_account_pipeline (empresa_id, stage, owner, next_action, notes)
  VALUES (p_empresa_id, COALESCE(NULLIF(btrim(p_stage), ''), 'trial'), NULLIF(btrim(p_owner), ''), NULLIF(btrim(p_next_action), ''), NULLIF(btrim(p_notes), ''))
  ON CONFLICT (empresa_id)
  DO UPDATE SET
    stage = EXCLUDED.stage,
    owner = EXCLUDED.owner,
    next_action = EXCLUDED.next_action,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_broadcasts()
RETURNS SETOF public.master_broadcasts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.master_broadcasts ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_create_broadcast(
  p_title text,
  p_content text,
  p_segment jsonb DEFAULT '{}'::jsonb,
  p_channels jsonb DEFAULT '["in_app"]'::jsonb,
  p_status text DEFAULT 'draft'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.master_broadcasts (title, content, segment, channels, status)
  VALUES (p_title, p_content, COALESCE(p_segment, '{}'::jsonb), COALESCE(p_channels, '["in_app"]'::jsonb), COALESCE(NULLIF(btrim(p_status), ''), 'draft'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_release_rollouts()
RETURNS SETOF public.master_release_rollouts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.master_release_rollouts ORDER BY updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_release_rollout(
  p_id uuid DEFAULT NULL,
  p_feature_code text DEFAULT NULL,
  p_target_segment jsonb DEFAULT '{}'::jsonb,
  p_rollout_percent int DEFAULT 0,
  p_status text DEFAULT 'draft'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.master_release_rollouts (feature_code, target_segment, rollout_percent, status)
    VALUES (COALESCE(NULLIF(btrim(p_feature_code), ''), 'feature_sem_codigo'), COALESCE(p_target_segment, '{}'::jsonb), GREATEST(LEAST(COALESCE(p_rollout_percent, 0), 100), 0), COALESCE(NULLIF(btrim(p_status), ''), 'draft'))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.master_release_rollouts
    SET
      feature_code = COALESCE(NULLIF(btrim(p_feature_code), ''), feature_code),
      target_segment = COALESCE(p_target_segment, target_segment),
      rollout_percent = GREATEST(LEAST(COALESCE(p_rollout_percent, rollout_percent), 100), 0),
      status = COALESCE(NULLIF(btrim(p_status), ''), status),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_billing_negotiations()
RETURNS TABLE (id uuid, empresa_id uuid, empresa_nome text, fatura_id uuid, status text, acordo_valor_centavos bigint, observacao text, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.empresa_id, e.nome, n.fatura_id, n.status, n.acordo_valor_centavos, n.observacao, n.updated_at
  FROM public.master_billing_negotiations n
  JOIN public.empresas e ON e.id = n.empresa_id
  ORDER BY n.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_billing_negotiation(
  p_id uuid DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL,
  p_fatura_id uuid DEFAULT NULL,
  p_status text DEFAULT 'aberta',
  p_acordo_valor_centavos bigint DEFAULT 0,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.master_billing_negotiations (empresa_id, fatura_id, status, acordo_valor_centavos, observacao)
    VALUES (p_empresa_id, p_fatura_id, COALESCE(NULLIF(btrim(p_status), ''), 'aberta'), COALESCE(p_acordo_valor_centavos, 0), NULLIF(btrim(p_observacao), ''))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.master_billing_negotiations
    SET
      status = COALESCE(NULLIF(btrim(p_status), ''), status),
      acordo_valor_centavos = COALESCE(p_acordo_valor_centavos, acordo_valor_centavos),
      observacao = COALESCE(NULLIF(btrim(p_observacao), ''), observacao),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_kb_articles()
RETURNS SETOF public.master_kb_articles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.master_kb_articles ORDER BY updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_kb_article(
  p_id uuid DEFAULT NULL,
  p_categoria text DEFAULT 'geral',
  p_titulo text DEFAULT NULL,
  p_conteudo text DEFAULT NULL,
  p_ativo boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.master_kb_articles (categoria, titulo, conteudo, ativo)
    VALUES (COALESCE(NULLIF(btrim(p_categoria), ''), 'geral'), COALESCE(NULLIF(btrim(p_titulo), ''), 'sem titulo'), COALESCE(p_conteudo, ''), COALESCE(p_ativo, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.master_kb_articles
    SET
      categoria = COALESCE(NULLIF(btrim(p_categoria), ''), categoria),
      titulo = COALESCE(NULLIF(btrim(p_titulo), ''), titulo),
      conteudo = COALESCE(p_conteudo, conteudo),
      ativo = COALESCE(p_ativo, ativo),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_support_macros()
RETURNS SETOF public.master_support_macros
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.master_support_macros ORDER BY updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_support_macro(
  p_id uuid DEFAULT NULL,
  p_titulo text DEFAULT NULL,
  p_conteudo text DEFAULT NULL,
  p_ativo boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.master_support_macros (titulo, conteudo, ativo)
    VALUES (COALESCE(NULLIF(btrim(p_titulo), ''), 'macro sem titulo'), COALESCE(p_conteudo, ''), COALESCE(p_ativo, true))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.master_support_macros
    SET
      titulo = COALESCE(NULLIF(btrim(p_titulo), ''), titulo),
      conteudo = COALESCE(p_conteudo, conteudo),
      ativo = COALESCE(p_ativo, ativo),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_lgpd_requests()
RETURNS TABLE (id uuid, empresa_id uuid, empresa_nome text, tipo text, status text, detalhes text, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.empresa_id, e.nome, r.tipo, r.status, r.detalhes, r.updated_at
  FROM public.master_lgpd_requests r
  JOIN public.empresas e ON e.id = r.empresa_id
  ORDER BY r.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_lgpd_request(
  p_id uuid DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_status text DEFAULT 'aberta',
  p_detalhes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.master_lgpd_requests (empresa_id, tipo, status, detalhes)
    VALUES (p_empresa_id, COALESCE(NULLIF(btrim(p_tipo), ''), 'acesso'), COALESCE(NULLIF(btrim(p_status), ''), 'aberta'), NULLIF(btrim(p_detalhes), ''))
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.master_lgpd_requests
    SET
      tipo = COALESCE(NULLIF(btrim(p_tipo), ''), tipo),
      status = COALESCE(NULLIF(btrim(p_status), ''), status),
      detalhes = COALESCE(NULLIF(btrim(p_detalhes), ''), detalhes),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_list_onboarding_scores()
RETURNS TABLE (id uuid, empresa_id uuid, empresa_nome text, score int, status text, checklist jsonb, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.empresa_id, e.nome, s.score, s.status, s.checklist, s.updated_at
  FROM public.master_onboarding_scores s
  JOIN public.empresas e ON e.id = s.empresa_id
  ORDER BY s.score DESC, s.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.master_upsert_onboarding_score(
  p_empresa_id uuid,
  p_score int,
  p_status text,
  p_checklist jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.master_onboarding_scores (empresa_id, score, status, checklist)
  VALUES (p_empresa_id, GREATEST(LEAST(COALESCE(p_score, 0), 100), 0), COALESCE(NULLIF(btrim(p_status), ''), 'inicial'), COALESCE(p_checklist, '{}'::jsonb))
  ON CONFLICT (empresa_id)
  DO UPDATE SET
    score = EXCLUDED.score,
    status = EXCLUDED.status,
    checklist = EXCLUDED.checklist,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.master_data_room_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mrr bigint := 0;
  v_ativos int := 0;
  v_trial int := 0;
  v_past_due int := 0;
  v_churn_proxy numeric := 0;
  v_receita_30d bigint := 0;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT COUNT(*) FILTER (WHERE a.status = 'ativa')::int,
         COUNT(*) FILTER (WHERE a.status = 'trial')::int,
         COUNT(*) FILTER (WHERE a.status = 'past_due')::int,
         COALESCE(SUM(CASE WHEN a.status = 'ativa' THEN p.valor_centavos ELSE 0 END), 0)::bigint
  INTO v_ativos, v_trial, v_past_due, v_mrr
  FROM public.assinaturas a
  LEFT JOIN public.planos p ON p.id = a.plano_id;

  SELECT COALESCE(SUM(f.valor_centavos), 0)::bigint
  INTO v_receita_30d
  FROM public.faturas f
  WHERE f.status = 'paga' AND f.created_at >= now() - interval '30 days';

  IF (v_ativos + v_trial) > 0 THEN
    v_churn_proxy := ROUND((v_past_due::numeric / (v_ativos + v_trial)::numeric) * 100, 2);
  END IF;

  RETURN jsonb_build_object(
    'mrr_centavos', v_mrr,
    'ativos', v_ativos,
    'trial', v_trial,
    'past_due', v_past_due,
    'churn_proxy_pct', v_churn_proxy,
    'receita_30d_centavos', v_receita_30d
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.master_platform_health(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_bulk_empresa_action(uuid[], text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_empresa_audit(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_risco_empresas(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_pipeline() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_pipeline(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_broadcasts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_create_broadcast(text, text, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_release_rollouts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_release_rollout(uuid, text, jsonb, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_billing_negotiations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_billing_negotiation(uuid, uuid, uuid, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_kb_articles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_kb_article(uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_support_macros() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_support_macro(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_lgpd_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_lgpd_request(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_list_onboarding_scores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_upsert_onboarding_score(uuid, int, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_data_room_metrics() TO authenticated;
