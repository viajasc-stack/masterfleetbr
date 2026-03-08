-- Garante assinatura trial para empresa criada manualmente

CREATE OR REPLACE FUNCTION public.ensure_assinatura_for_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.empresa_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_plano_id
  FROM public.planos
  WHERE ativo = true
  ORDER BY ordem
  LIMIT 1;

  INSERT INTO public.assinaturas (empresa_id, plano_id, status, trial_ate)
  VALUES (
    NEW.id,
    v_plano_id,
    'trial',
    now() + interval '7 days'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_auto_assinatura_trial ON public.empresas;
CREATE TRIGGER trg_empresas_auto_assinatura_trial
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.ensure_assinatura_for_empresa();
