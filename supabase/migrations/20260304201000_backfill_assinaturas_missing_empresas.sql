-- Backfill: cria assinatura trial para empresas já existentes sem assinatura

INSERT INTO public.assinaturas (empresa_id, plano_id, status, trial_ate)
SELECT
  e.id,
  (
    SELECT p.id
    FROM public.planos p
    WHERE p.ativo = true
    ORDER BY p.ordem
    LIMIT 1
  ) AS plano_id,
  'trial' AS status,
  now() + interval '7 days' AS trial_ate
FROM public.empresas e
LEFT JOIN public.assinaturas a ON a.empresa_id = e.id
WHERE a.id IS NULL;
