# Edge Functions (resumo)

Lista de Edge Functions presentes no projeto e suas responsabilidades:

- `mp-create-pix` — cria pagamento PIX no Mercado Pago e salva `mp_payment_id`, `pix_copia_cola`, `pix_qr_code` na tabela `faturas`.
- `mp-webhook` — recebe webhooks do Mercado Pago, verifica assinatura (opcional) e marca faturas como pagas; renova assinaturas.
- `billing-cycle` — cron que gera faturas, marca trials expiradas e bloqueia assinaturas em atraso.
- `create-motorista` — (nova) create motorista + cria usuário no Auth via `SUPABASE_SERVICE_ROLE_KEY` e insere `profiles` e `motoristas`.

Secrets necessários (Edge Functions):
- `SUPABASE_SERVICE_ROLE_KEY` — chave de serviço do Supabase (sempre manter segura).
- `MP_ACCESS_TOKEN` — token do Mercado Pago (teste/prod).
- `MP_WEBHOOK_SECRET` — segredo para verificar assinatura do webhook (opcional, recomendado).

Deploy rápido:
1. Faça login: `npx supabase login`
2. Link no projeto: `npx supabase link --project-ref <project-ref>`
3. Deploy: `npx supabase functions deploy mp-create-pix` etc.
