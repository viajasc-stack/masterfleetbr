-- Evita dependência de parâmetro de banco (app.super_admin_uid),
-- que pode falhar com "permission denied to set parameter".

CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS super_admins_select_own ON public.super_admins;
CREATE POLICY super_admins_select_own
  ON public.super_admins
  FOR SELECT
  USING (auth.uid() = user_id);

-- sem policies de escrita para usuários comuns

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.super_admins sa
    WHERE sa.user_id = auth.uid()
  )
  OR auth.uid()::text = current_setting('app.super_admin_uid', true);
END;
$$;

-- Seed do usuário master atual (se existir no auth.users)
INSERT INTO public.super_admins (user_id, created_by)
SELECT u.id, u.id
FROM auth.users u
WHERE lower(u.email) = 'adm@masterfleetbr.com.br'
ON CONFLICT (user_id) DO NOTHING;
