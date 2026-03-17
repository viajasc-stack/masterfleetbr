# Edge Functions (resumo)

Lista de Edge Functions presentes no projeto e suas responsabilidades:

- `mp-create-pix` — cria pagamento PIX no Mercado Pago e salva `mp_payment_id`, `pix_copia_cola`, `pix_qr_code` na tabela `faturas`.
- `mp-webhook` — recebe webhooks de pagamento do Mercado Pago **e Asaas**, marca faturas como pagas e renova assinaturas.
- `billing-cycle` — cron que gera faturas, marca trials expiradas e bloqueia assinaturas em atraso.
- `create-motorista` — (nova) create motorista + cria usuário no Auth via `SUPABASE_SERVICE_ROLE_KEY` e insere `profiles` e `motoristas`.
- `push-dispatch` — processa fila `motorista_push_outbox`, envia notificações push (Expo), aplica retry e desativa tokens inválidos.
- `whatsapp-dispatch` — processa fila `whatsapp_outbox`, envia mensagens para o provedor configurado e grava logs em `whatsapp_dispatch_logs`.
- `whatsapp-inbound` — recebe webhooks de mensagens recebidas, grava `whatsapp_inbound_logs` e processa automação para suporte.

Secrets necessários (Edge Functions):
- `SUPABASE_SERVICE_ROLE_KEY` — chave de serviço do Supabase (sempre manter segura).
- `MP_ACCESS_TOKEN` — token do Mercado Pago (teste/prod).
- `MP_WEBHOOK_SECRET` — segredo para verificar assinatura do webhook (opcional, recomendado).
- `ASAAS_API_KEY` — chave da API do Asaas (fallback, caso não use `gateway_configs.access_token`).
- `ASAAS_API_URL` — URL base do Asaas (opcional; padrão `https://api.asaas.com/v3`).
- `PUSH_BATCH_LIMIT` — quantidade por execução do `push-dispatch` (opcional, padrão 50).
- `PUSH_DISPATCH_SECRET` — segredo opcional para autorizar chamadas do `push-dispatch` via Bearer token.
- `WHATSAPP_BATCH_LIMIT` — quantidade de mensagens por execução do dispatcher (opcional, padrão 25).

Deploy rápido:
1. Faça login: `npx supabase login`
2. Link no projeto: `npx supabase link --project-ref <project-ref>`
3. Deploy: `npx supabase functions deploy mp-create-pix` etc.

## WhatsApp (dispatcher)

1. Aplicar migration:
   - `supabase/migrations/20260306111000_whatsapp_integration_foundation.sql`
2. Deploy da function:
   - `npx supabase functions deploy whatsapp-dispatch --no-verify-jwt`
3. Configurar `whatsapp_configs` por empresa (provider, api_url, api_token, ativo=true).
4. Disparar execução (cron ou manual HTTP) para processar a fila.

## WhatsApp (inbound)

1. Aplicar migration:
   - `supabase/migrations/20260306120000_whatsapp_inbound_automation.sql`
2. Deploy da function:
   - `npx supabase functions deploy whatsapp-inbound --no-verify-jwt`
3. Configurar webhook do provider para apontar para:
   - `https://<project-ref>.functions.supabase.co/whatsapp-inbound?provider=<provider>&empresa_id=<uuid-opcional>`
4. (Opcional) enviar header `x-webhook-secret` igual ao configurado em `whatsapp_configs.webhook_secret`.

## Push (dispatcher)

1. Aplicar migration:
   - `supabase/migrations/20260315060000_push_dispatch_notifications.sql`
2. Deploy da function:
   - `npx supabase functions deploy push-dispatch --no-verify-jwt`
3. (Opcional, recomendado) configurar secret:
   - `PUSH_DISPATCH_SECRET`
4. Executar manualmente ou por scheduler para processar a fila `motorista_push_outbox`.
