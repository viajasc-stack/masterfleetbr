-- Torna a resolução de empresa mais resiliente para usuários sem profile
-- (ex.: usuários legados apenas na tabela usuarios ou motoristas no app).
CREATE OR REPLACE FUNCTION public.minha_empresa_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1),
    (SELECT u.empresa_id FROM public.usuarios u WHERE u.auth_user_id = auth.uid() LIMIT 1),
    (SELECT m.empresa_id FROM public.motoristas m WHERE m.auth_user_id = auth.uid() LIMIT 1)
  );
$$;
