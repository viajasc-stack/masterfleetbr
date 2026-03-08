-- WhatsApp: gestão de configuração restrita ao Master
-- Escopo: integração usada para notificações do sistema.

-- Importante: esta migration pode ser executada mesmo se a fundação do WhatsApp
-- ainda não tiver sido aplicada. Nesse caso, ela simplesmente não altera nada.

DO $$
BEGIN
  -- Configurações de provider/token/url: somente super admin altera.
  IF to_regclass('public.whatsapp_configs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_configs_empresa_upsert ON public.whatsapp_configs';
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_configs_master_write ON public.whatsapp_configs';
    EXECUTE 'CREATE POLICY whatsapp_configs_master_write
      ON public.whatsapp_configs
      FOR ALL
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin())';
  END IF;

  -- Templates de mensagem: somente super admin altera.
  IF to_regclass('public.whatsapp_templates') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_templates_empresa_upsert ON public.whatsapp_templates';
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_templates_master_write ON public.whatsapp_templates';
    EXECUTE 'CREATE POLICY whatsapp_templates_master_write
      ON public.whatsapp_templates
      FOR ALL
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin())';
  END IF;

  -- Outbox não deve ser manipulada por usuários de empresa.
  IF to_regclass('public.whatsapp_outbox') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_outbox_insert ON public.whatsapp_outbox';
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_outbox_update ON public.whatsapp_outbox';
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_outbox_master_insert ON public.whatsapp_outbox';
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_outbox_master_update ON public.whatsapp_outbox';

    EXECUTE 'CREATE POLICY whatsapp_outbox_master_insert
      ON public.whatsapp_outbox
      FOR INSERT
      WITH CHECK (public.is_super_admin())';

    EXECUTE 'CREATE POLICY whatsapp_outbox_master_update
      ON public.whatsapp_outbox
      FOR UPDATE
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin())';
  END IF;

  -- Logs inbound: sem escrita por empresa
  IF to_regclass('public.whatsapp_inbound_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_inbound_update_service ON public.whatsapp_inbound_logs';
    EXECUTE 'DROP POLICY IF EXISTS whatsapp_inbound_master_update ON public.whatsapp_inbound_logs';
    EXECUTE 'CREATE POLICY whatsapp_inbound_master_update
      ON public.whatsapp_inbound_logs
      FOR UPDATE
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin())';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
