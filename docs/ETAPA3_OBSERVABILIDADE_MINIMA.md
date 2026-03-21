# Etapa 3 — Observabilidade mínima (guia operacional)

## Objetivo
Estabelecer um padrão mínimo e prático para diagnosticar falhas críticas em produção com rapidez.

---

## 1) Padrão de logs adotado

### Frontend (web)
- Utilitário central: `src/lib/observability.ts`
- Formato:
  - `ts` (timestamp)
  - `level` (`info` | `error`)
  - `scope` (ex.: `financeiro.faturas`)
  - `message`
  - `meta`

### Scopes já instrumentados
- `financeiro.faturas`
- `operacao.ordens_servico`

### Edge functions
- Já possuem `console.error/console.log` em pontos críticos (billing/pagamento/webhooks/whatsapp).

---

## 2) Onde monitorar primeiro (rotina diária)
1. **Billing / Pagamentos**
   - Edge functions: `mp-create-payment`, `mp-create-pix`, `mp-webhook`, `billing-cycle`
2. **Operação OS**
   - Falhas de cancelamento/atualização de status
3. **WhatsApp/Push**
   - `whatsapp-dispatch`, `whatsapp-inbound`, `push-dispatch`

---

## 3) Triagem rápida de incidente
1. Identificar `scope` e horário aproximado.
2. Buscar logs de erro no frontend/edge function correspondente.
3. Correlacionar com IDs em `meta` (`fatura_id`, `os_id`, etc.).
4. Validar estado no banco (status final em tabela principal).
5. Registrar causa + ação corretiva no histórico operacional.

---

## 4) Tabelas/fonte de apoio para auditoria
- `public.webhook_logs`
- `public.notifications_audit`
- `public.whatsapp_dispatch_logs`
- `public.whatsapp_inbound_logs`
- `public.support_tickets` / `public.support_messages`
- Eventos operacionais de OS (`log_os_evento`/triggers já existentes)

---

## 5) Próximos incrementos recomendados (após mínimo)
1. Padronizar `scope` para todos módulos críticos (financeiro, agenda, suporte, manutenção).
2. Criar painel central no master com agregação por severidade.
3. Adicionar correlação por `request_id` entre frontend e edge function.
4. Definir alertas ativos (ex.: pico de erro em pagamentos/webhooks).
