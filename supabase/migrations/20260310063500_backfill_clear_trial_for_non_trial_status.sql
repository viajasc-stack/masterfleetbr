-- Higienização: remove trial_ate de assinaturas que não estão em status trial
UPDATE public.assinaturas
SET trial_ate = NULL,
    updated_at = now()
WHERE status <> 'trial'
  AND trial_ate IS NOT NULL;

NOTIFY pgrst, 'reload schema';
