# WhatsApp — Guia de integração (fundação)

## O que foi preparado

### Banco de dados

Migration: `supabase/migrations/20260306111000_whatsapp_integration_foundation.sql`

Inclui:

- Campo `empresas.whatsapp` (número principal da empresa para receber alertas)
- `whatsapp_configs` (configuração do provider por empresa)
- `whatsapp_templates` (templates customizáveis por empresa)
- `whatsapp_outbox` (fila de envio)
- `whatsapp_dispatch_logs` (auditoria de tentativas)
- RPC `whatsapp_enqueue(...)`
- Normalização de telefone `normalize_whatsapp_number(...)`
- Gatilhos automáticos:
  - resposta do suporte master → enfileira WhatsApp para empresa
  - evento de OS warning/critical → enfileira WhatsApp para empresa

Migration complementar:

- `supabase/migrations/20260306114000_whatsapp_module_rpcs.sql`

RPCs de operação no painel:

- `whatsapp_save_config(...)`
- `whatsapp_save_template(...)`
- `whatsapp_delete_template(...)`
- `whatsapp_retry_outbox(...)`
- `whatsapp_cancel_outbox(...)`
- `whatsapp_enqueue_test(...)`

> Observação de produto (escopo atual): a integração WhatsApp está centralizada no
> **Painel Master** em ` /master/configuracoes/whatsapp ` e é usada para
> **notificações do sistema para usuários/empresas**.
>
> Empresas **não podem alterar** configurações do provider, templates ou fila.

Inbound/automação de retorno:

- `supabase/migrations/20260306120000_whatsapp_inbound_automation.sql`
- tabela `whatsapp_inbound_logs`
- processamento automático via `whatsapp_process_inbound(...)`
  - se mensagem contém UUID de ticket existente: adiciona resposta no ticket
  - senão: cria ticket de suporte automaticamente

### Edge Function

Arquivo: `supabase/functions/whatsapp-dispatch/index.ts`

Responsável por:

- ler itens `queued` da `whatsapp_outbox`
- enviar para o provider configurado em `whatsapp_configs`
- aplicar retry com backoff exponencial
- registrar sucesso/erro em `whatsapp_dispatch_logs`

Inbound (webhook): `supabase/functions/whatsapp-inbound/index.ts`

Responsável por:

- receber webhook do provider
- identificar empresa por `empresa_id` (query) ou número
- registrar inbound em `whatsapp_inbound_logs`
- acionar `whatsapp_process_inbound(...)`

---

## Setup rápido

1. Aplicar migration no Supabase SQL Editor:
   - `20260306111000_whatsapp_integration_foundation.sql`

2. Deploy da function:

```bash
npx supabase functions deploy whatsapp-dispatch --no-verify-jwt
npx supabase functions deploy whatsapp-inbound --no-verify-jwt
```

3. Configurar variável opcional:

- `WHATSAPP_BATCH_LIMIT` (padrão: `25`)

4. Criar configuração por empresa em `whatsapp_configs`:

- `empresa_id`
- `provider`
- `api_url`
- `api_token`
- `ativo = true`

5. Garantir que `empresas.whatsapp` esteja preenchido.

---

## Como funciona o payload enviado ao provider

Dispatcher envia `POST` para `whatsapp_configs.api_url` com JSON:

```json
{
  "provider": "custom_webhook",
  "to": "5511999999999",
  "to_name": "Empresa X",
  "message": "texto da mensagem",
  "template_code": "support_reply",
  "variables": { "ticket_id": "..." },
  "from": "5511888888888",
  "instance_key": "abc",
  "outbox_id": "...",
  "empresa_id": "..."
}
```

Você pode conectar esse endpoint com:

- 360dialog
- Z-API
- Twilio WhatsApp
- Evolution API
- seu próprio middleware

---

## Próximos passos recomendados

1. Agendar cron para `whatsapp-dispatch` (processamento automático da fila).
2. Ajustar parser inbound para payload específico do provider escolhido.
3. Implementar atualização de status de entrega (delivered/read) via webhook.
4. Incluir monitoramento master consolidado de fila/falhas por empresa.
5. Escalonamento de alertas críticos (WhatsApp + notificação interna + e-mail).

---

## Regras de acesso (escopo atual)

- Página de configuração WhatsApp disponível apenas no Master.
- Escrita em `whatsapp_configs`, `whatsapp_templates` e manipulação da `whatsapp_outbox`
  restrita a super admin (migration `20260306193000_whatsapp_master_only_policies.sql`).
- Empresas permanecem apenas como destinatárias de notificações do sistema.
