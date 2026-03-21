# Etapa 11 — Alertas multicanal com priorização por scope

## Objetivo
Evoluir o alerta externo para um roteador multicanal com decisão por prioridade.

## Implementação

Arquivo principal: `src/app/api/observability/alert/route.ts`

### 1) Classificação de prioridade
- `low`, `medium`, `high`, `critical`
- baseada em:
  - `scope` crítico
  - conteúdo da mensagem (`pagamento`, `fatura`, `webhook`)
  - `errors_in_window` no `meta`

### 2) Canais suportados
- **Webhook genérico**
  - variáveis:
    - `OBSERVABILITY_ALERT_WEBHOOK_URL`
    - `OBSERVABILITY_ALERT_WEBHOOK_SECRET` (opcional)

- **Email (Resend)**
  - variáveis:
    - `RESEND_API_KEY`
    - `OBSERVABILITY_ALERT_EMAIL_TO`
    - `OBSERVABILITY_ALERT_EMAIL_FROM` (opcional)
  - envio para prioridade `>= medium`.

- **WhatsApp (fila interna)**
  - usa tabela `whatsapp_outbox`
  - somente prioridade `>= high`
  - depende de:
    - `empresa.whatsapp` preenchido
    - `whatsapp_configs.ativo = true`

### 3) Resposta da API
A rota retorna `channels` com resultado por canal (`sent`, `queued`, `skipped_*`, `failed_*`) e `priority` calculada.

## Fluxo resumido
1. utilitário detecta burst e chama `/api/observability/alert`
2. API classifica prioridade
3. API envia para webhook/email/whatsapp conforme regra
4. retorno inclui status por canal para auditoria operacional

## Próximo passo sugerido
- Persistir log de entrega multicanal (tabela dedicada `observability_alert_dispatch_logs`) para histórico de envio por canal.
