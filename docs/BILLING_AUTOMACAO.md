# Billing automático (billing-cycle)

## Como está hoje

- A Edge Function `billing-cycle` **não roda sozinha dentro do Supabase**.
- Hoje ela é disparada por agendamento no GitHub Actions:
  - Arquivo: `.github/workflows/schedule-billing.yml`
  - Cron atual: `0 0 1 * *` (dia 1 de cada mês, 00:00 UTC)
  - Chamada: `GET /functions/v1/billing-cycle`
  - Auth: `Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY`

## Anotação para futuro (Painel Master)

Objetivo: permitir configuração de automação pelo painel master, sem editar YAML.

Sugestão de campos no painel:

- `billing_automation_enabled` (boolean)
- `billing_cron_expression` (text)
- `billing_timezone` (text, ex: `America/Sao_Paulo`)
- `billing_last_run_at` (timestamp)
- `billing_last_status` (ok/erro + mensagem)

Sugestão operacional:

1. Painel master salva configuração no banco.
2. Um scheduler central (GitHub Action/worker) lê configuração ativa.
3. Dispara `billing-cycle` conforme configuração.
4. Registra execução para auditoria/monitoramento.
