# Go-live web (empresa cobaia) — checklist rápido

## 1) Banco (migrations)

Aplicar em ordem:

1. `20260306111000_whatsapp_integration_foundation.sql`
2. `20260306120000_whatsapp_inbound_automation.sql`
3. `20260306193000_whatsapp_master_only_policies.sql`
4. `20260306203000_gateway_configs_add_asaas.sql`

## 2) Edge Functions (deploy)

```bash
npx supabase functions deploy mp-create-pix --no-verify-jwt
npx supabase functions deploy mp-create-payment --no-verify-jwt
npx supabase functions deploy mp-webhook --no-verify-jwt
npx supabase functions deploy billing-cycle --no-verify-jwt
```

## 3) Configuração no Master (web)

1. Acesse ` /master/configuracoes/asaas `
2. Preencha:
   - `Ativar Asaas`
   - `API URL` (normal: `https://api.asaas.com/v3`)
   - `API Key`
   - `Webhook Secret` (opcional)
3. Salve

## 4) Webhook Asaas

Configurar no painel Asaas para apontar para:

`https://<PROJECT-REF>.functions.supabase.co/mp-webhook?provider=asaas`

Eventos recomendados:
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_OVERDUE`

## 5) Teste de pagamento (empresa)

1. Entre como empresa com fatura aberta
2. Vá em ` /financeiro/faturas `
3. Gere PIX
4. Verifique:
   - `faturas.payment_provider = 'asaas'`
   - `faturas.provider_payment_id` preenchido
   - `faturas.pix_copia_cola` e `pix_qr_code` preenchidos

Após pagamento confirmado no Asaas:
- `faturas.status = 'paga'`
- `assinaturas.status = 'ativa'`

## 6) Smoke final (web)

- Login master e empresa
- Navegação painel master/configurações/Asaas
- Fluxo de bloqueado → pagamento → desbloqueio
- Suporte (empresa e master)
- Dashboard empresa pós-liberação

## 7) Validação pós-deploy (SQL rápido)

```sql
select provider, ativo, api_url, updated_at
from public.gateway_configs
where provider in ('asaas','mercado_pago')
order by provider;

select id, status, payment_provider, provider_payment_id, provider_external_reference, updated_at
from public.faturas
order by created_at desc
limit 20;

select id, empresa_id, status, proxima_cobranca, updated_at
from public.assinaturas
order by updated_at desc
limit 20;

select source, provider, empresa_id, created_at
from public.webhook_logs
order by created_at desc
limit 30;
```

## 8) Smoke automatizado via script

Com variáveis de ambiente (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) configuradas:

```bash
npm run smoke:web
```

> Observação: sem credenciais reais de gateway, o script valida estrutura/chamadas e aceita erro esperado de provedor externo.
