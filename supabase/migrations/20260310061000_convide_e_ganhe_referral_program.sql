-- Programa Convide e Ganhe
-- Regras:
-- - Empresa só pode convidar quando assinatura estiver ATIVA
-- - Campanha configurável no painel master (valor fixo ou percentual para cada lado)
-- - Desconto aplicado automaticamente na próxima fatura aberta

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS valor_bruto_centavos bigint,
  ADD COLUMN IF NOT EXISTS desconto_centavos bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_detalhe jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.referral_codes (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL,
  convidante_empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  convidada_empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  invited_admin_email text,
  status text NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'activated', 'cancelled')),
  campaign_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  signed_up_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convidada_empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_convidante ON public.referrals (convidante_empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  beneficiary_type text NOT NULL CHECK (beneficiary_type IN ('inviter', 'invitee')),
  discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value numeric(12,4) NOT NULL,
  remaining_centavos bigint,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'consumed', 'cancelled', 'expired')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_referral_credits_empresa_status ON public.referral_credits (empresa_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_credit_unique_per_beneficiary
  ON public.referral_credits (referral_id, beneficiary_type)
  WHERE referral_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referral_credit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.referral_credits(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fatura_id uuid NOT NULL REFERENCES public.faturas(id) ON DELETE CASCADE,
  applied_centavos bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_apps_fatura ON public.referral_credit_applications (fatura_id);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credit_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_codes_select_empresa ON public.referral_codes;
CREATE POLICY referral_codes_select_empresa ON public.referral_codes
  FOR SELECT USING (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS referrals_select_empresa ON public.referrals;
CREATE POLICY referrals_select_empresa ON public.referrals
  FOR SELECT USING (
    convidante_empresa_id = public.minha_empresa_id() OR convidada_empresa_id = public.minha_empresa_id()
  );

DROP POLICY IF EXISTS referral_credits_select_empresa ON public.referral_credits;
CREATE POLICY referral_credits_select_empresa ON public.referral_credits
  FOR SELECT USING (empresa_id = public.minha_empresa_id());

DROP POLICY IF EXISTS referral_apps_select_empresa ON public.referral_credit_applications;
CREATE POLICY referral_apps_select_empresa ON public.referral_credit_applications
  FOR SELECT USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.get_referral_campaign()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  IF to_regclass('public.master_settings') IS NULL THEN
    RETURN jsonb_build_object(
      'active', false,
      'inviter', jsonb_build_object('type', 'fixed', 'value', 0),
      'invitee', jsonb_build_object('type', 'fixed', 'value', 0)
    );
  END IF;

  SELECT ms.value INTO v
  FROM public.master_settings ms
  WHERE ms.key = 'referral_campaign'
  LIMIT 1;

  RETURN jsonb_build_object(
    'active', COALESCE((v->>'active')::boolean, false),
    'inviter', jsonb_build_object(
      'type', COALESCE(NULLIF(lower(v #>> '{inviter,type}'), ''), 'fixed'),
      'value', COALESCE((v #>> '{inviter,value}')::numeric, 0)
    ),
    'invitee', jsonb_build_object(
      'type', COALESCE(NULLIF(lower(v #>> '{invitee,type}'), ''), 'fixed'),
      'value', COALESCE((v #>> '{invitee,value}')::numeric, 0)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := lower(encode(gen_random_bytes(5), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes rc WHERE rc.code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.empresa_id = p_empresa_id
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  v_code := public.generate_referral_code();
  INSERT INTO public.referral_codes (empresa_id, code, active)
  VALUES (p_empresa_id, v_code, true)
  ON CONFLICT (empresa_id)
  DO UPDATE SET code = EXCLUDED.code, updated_at = now()
  RETURNING code INTO v_code;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_referral_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid := public.minha_empresa_id();
  v_code text;
  v_campaign jsonb := public.get_referral_campaign();
  v_can_invite boolean := false;
  v_referred jsonb := '[]'::jsonb;
  v_total_signed int := 0;
  v_total_activated int := 0;
BEGIN
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_not_found';
  END IF;

  v_code := public.ensure_referral_code(v_empresa_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.empresa_id = v_empresa_id
      AND a.status = 'ativa'
  ) INTO v_can_invite;

  SELECT COUNT(*)::int,
         COUNT(*) FILTER (WHERE r.status = 'activated')::int
    INTO v_total_signed, v_total_activated
    FROM public.referrals r
   WHERE r.convidante_empresa_id = v_empresa_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'referral_id', r.id,
        'empresa_id', e.id,
        'empresa_nome', e.nome,
        'status', r.status,
        'signed_up_at', r.signed_up_at,
        'activated_at', r.activated_at,
        'plano_nome', p.nome,
        'assinatura_status', a.status
      )
      ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_referred
  FROM public.referrals r
  JOIN public.empresas e ON e.id = r.convidada_empresa_id
  LEFT JOIN LATERAL (
    SELECT ax.status, ax.plano_id
      FROM public.assinaturas ax
     WHERE ax.empresa_id = e.id
     ORDER BY ax.created_at DESC
     LIMIT 1
  ) a ON true
  LEFT JOIN public.planos p ON p.id = a.plano_id
  WHERE r.convidante_empresa_id = v_empresa_id;

  RETURN jsonb_build_object(
    'empresa_id', v_empresa_id,
    'referral_code', v_code,
    'campaign', v_campaign,
    'can_invite', v_can_invite,
    'total_signed_up', v_total_signed,
    'total_activated', v_total_activated,
    'referred_companies', v_referred
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_referral_on_signup(
  p_referral_code text,
  p_new_empresa_id uuid,
  p_new_admin_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := lower(NULLIF(btrim(COALESCE(p_referral_code, '')), ''));
  v_campaign jsonb := public.get_referral_campaign();
  v_inviter_empresa_id uuid;
  v_referral_id uuid;
  v_invitee_type text;
  v_invitee_value numeric;
BEGIN
  IF v_code IS NULL OR p_new_empresa_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE((v_campaign->>'active')::boolean, false) IS DISTINCT FROM true THEN
    RETURN NULL;
  END IF;

  SELECT rc.empresa_id
    INTO v_inviter_empresa_id
    FROM public.referral_codes rc
   WHERE rc.code = v_code
     AND rc.active = true
   LIMIT 1;

  IF v_inviter_empresa_id IS NULL OR v_inviter_empresa_id = p_new_empresa_id THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.empresa_id = v_inviter_empresa_id
      AND a.status = 'ativa'
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.referrals r WHERE r.convidada_empresa_id = p_new_empresa_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.referrals (
    referral_code,
    convidante_empresa_id,
    convidada_empresa_id,
    invited_admin_email,
    status,
    campaign_snapshot,
    signed_up_at
  ) VALUES (
    v_code,
    v_inviter_empresa_id,
    p_new_empresa_id,
    NULLIF(btrim(COALESCE(p_new_admin_email, '')), ''),
    'signed_up',
    v_campaign,
    now()
  )
  RETURNING id INTO v_referral_id;

  v_invitee_type := COALESCE(NULLIF(lower(v_campaign #>> '{invitee,type}'), ''), 'fixed');
  v_invitee_value := COALESCE((v_campaign #>> '{invitee,value}')::numeric, 0);

  IF v_invitee_value > 0 THEN
    INSERT INTO public.referral_credits (
      empresa_id,
      referral_id,
      beneficiary_type,
      discount_type,
      discount_value,
      remaining_centavos,
      status,
      notes
    ) VALUES (
      p_new_empresa_id,
      v_referral_id,
      'invitee',
      CASE WHEN v_invitee_type = 'percent' THEN 'percent' ELSE 'fixed' END,
      v_invitee_value,
      CASE WHEN v_invitee_type = 'fixed' THEN GREATEST(round(v_invitee_value * 100)::bigint, 0) ELSE NULL END,
      'available',
      'Crédito de convite para empresa convidada'
    );
  END IF;

  RETURN v_referral_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_referral_assinatura_ativa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral record;
  v_campaign jsonb;
  v_inviter_type text;
  v_inviter_value numeric;
BEGIN
  IF NEW.status <> 'ativa' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'ativa' THEN
    RETURN NEW;
  END IF;

  SELECT r.*
    INTO v_referral
    FROM public.referrals r
   WHERE r.convidada_empresa_id = NEW.empresa_id
     AND r.status = 'signed_up'
   ORDER BY r.created_at DESC
   LIMIT 1;

  IF v_referral.id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.referrals
     SET status = 'activated',
         activated_at = now()
   WHERE id = v_referral.id;

  v_campaign := COALESCE(v_referral.campaign_snapshot, '{}'::jsonb);
  v_inviter_type := COALESCE(NULLIF(lower(v_campaign #>> '{inviter,type}'), ''), 'fixed');
  v_inviter_value := COALESCE((v_campaign #>> '{inviter,value}')::numeric, 0);

  IF v_inviter_value > 0 THEN
    INSERT INTO public.referral_credits (
      empresa_id,
      referral_id,
      beneficiary_type,
      discount_type,
      discount_value,
      remaining_centavos,
      status,
      notes
    ) VALUES (
      v_referral.convidante_empresa_id,
      v_referral.id,
      'inviter',
      CASE WHEN v_inviter_type = 'percent' THEN 'percent' ELSE 'fixed' END,
      v_inviter_value,
      CASE WHEN v_inviter_type = 'fixed' THEN GREATEST(round(v_inviter_value * 100)::bigint, 0) ELSE NULL END,
      'available',
      'Crédito por indicação ativada'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_assinatura_ativa ON public.assinaturas;
CREATE TRIGGER trg_referral_assinatura_ativa
  AFTER INSERT OR UPDATE OF status ON public.assinaturas
  FOR EACH ROW
  EXECUTE FUNCTION public.on_referral_assinatura_ativa();

CREATE OR REPLACE FUNCTION public.apply_referral_credits_to_invoice(
  p_empresa_id uuid,
  p_fatura_id uuid,
  p_valor_bruto_centavos bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining bigint := GREATEST(COALESCE(p_valor_bruto_centavos, 0), 0);
  v_total_discount bigint := 0;
  v_apply bigint;
  v_pct numeric;
  v_apps jsonb := '[]'::jsonb;
  c record;
BEGIN
  IF p_empresa_id IS NULL OR p_fatura_id IS NULL OR v_remaining <= 0 THEN
    RETURN jsonb_build_object('discount_centavos', 0, 'final_centavos', v_remaining, 'applications', v_apps);
  END IF;

  FOR c IN
    SELECT *
    FROM public.referral_credits rc
    WHERE rc.empresa_id = p_empresa_id
      AND rc.status = 'available'
    ORDER BY rc.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_apply := 0;

    IF c.discount_type = 'fixed' THEN
      v_apply := LEAST(v_remaining, GREATEST(COALESCE(c.remaining_centavos, 0), 0));
      IF v_apply <= 0 THEN
        CONTINUE;
      END IF;

      UPDATE public.referral_credits
         SET remaining_centavos = GREATEST(COALESCE(remaining_centavos, 0) - v_apply, 0),
             status = CASE WHEN COALESCE(remaining_centavos, 0) - v_apply <= 0 THEN 'consumed' ELSE 'available' END,
             consumed_at = CASE WHEN COALESCE(remaining_centavos, 0) - v_apply <= 0 THEN now() ELSE consumed_at END
       WHERE id = c.id;
    ELSE
      v_pct := GREATEST(COALESCE(c.discount_value, 0), 0);
      v_apply := floor(v_remaining * (v_pct / 100.0));
      v_apply := LEAST(v_apply, v_remaining);

      IF v_apply <= 0 THEN
        CONTINUE;
      END IF;

      UPDATE public.referral_credits
         SET status = 'consumed',
             remaining_centavos = 0,
             consumed_at = now()
       WHERE id = c.id;
    END IF;

    INSERT INTO public.referral_credit_applications (
      credit_id,
      empresa_id,
      fatura_id,
      applied_centavos
    ) VALUES (
      c.id,
      p_empresa_id,
      p_fatura_id,
      v_apply
    );

    v_apps := v_apps || jsonb_build_object(
      'credit_id', c.id,
      'beneficiary_type', c.beneficiary_type,
      'discount_type', c.discount_type,
      'applied_centavos', v_apply
    );

    v_total_discount := v_total_discount + v_apply;
    v_remaining := v_remaining - v_apply;
  END LOOP;

  RETURN jsonb_build_object(
    'discount_centavos', v_total_discount,
    'final_centavos', GREATEST(p_valor_bruto_centavos - v_total_discount, 0),
    'applications', v_apps
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.on_invoice_apply_referral_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_discount bigint := 0;
  v_final bigint := 0;
BEGIN
  IF NEW.status <> 'aberta' OR COALESCE(NEW.valor_centavos, 0) <= 0 THEN
    UPDATE public.faturas
       SET valor_bruto_centavos = COALESCE(valor_bruto_centavos, NEW.valor_centavos),
           desconto_centavos = COALESCE(desconto_centavos, 0)
     WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_result := public.apply_referral_credits_to_invoice(
    NEW.empresa_id,
    NEW.id,
    COALESCE(NEW.valor_centavos, 0)
  );

  v_discount := COALESCE((v_result->>'discount_centavos')::bigint, 0);
  v_final := COALESCE((v_result->>'final_centavos')::bigint, COALESCE(NEW.valor_centavos, 0));

  UPDATE public.faturas
     SET valor_bruto_centavos = COALESCE(valor_bruto_centavos, NEW.valor_centavos),
         desconto_centavos = v_discount,
         valor_centavos = v_final,
         desconto_detalhe = jsonb_build_object(
           'source', 'convide_e_ganhe',
           'applications', COALESCE(v_result->'applications', '[]'::jsonb)
         )
   WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_apply_referral_credits ON public.faturas;
CREATE TRIGGER trg_invoice_apply_referral_credits
  AFTER INSERT ON public.faturas
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invoice_apply_referral_credits();

GRANT EXECUTE ON FUNCTION public.get_referral_campaign() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_on_signup(text, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
