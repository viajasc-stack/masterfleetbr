-- Simple notifications table to notify admins
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nivel text NOT NULL DEFAULT 'info' CHECK (nivel IN ('info','warning','critical')),
  titulo text NOT NULL,
  mensagem text,
  lido boolean DEFAULT false,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_empresa" ON public.notifications USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (empresa_id = public.minha_empresa_id());

CREATE OR REPLACE FUNCTION public.set_empresa_id_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.empresa_id := public.minha_empresa_id();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notifications_empresa
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_notifications();
