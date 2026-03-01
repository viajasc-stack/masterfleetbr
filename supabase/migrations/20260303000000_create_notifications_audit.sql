-- Audit table for notification read actions
CREATE TABLE IF NOT EXISTS public.notifications_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_audit_empresa" ON public.notifications_audit USING (
  (SELECT empresa_id FROM public.notifications WHERE notifications.id = notification_id) = public.minha_empresa_id()
);
