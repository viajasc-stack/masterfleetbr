# Etapas 9 e 10 — Monitoramento no painel + alerta externo

## Objetivo
Fechar o ciclo de observabilidade com:
1) visualização operacional dos eventos no painel
2) notificação externa automática para alertas críticos

---

## Etapa 9 — Tela de Observabilidade

### Implementação
- Página: `src/app/(painel)/observabilidade/page.tsx`
- Menu lateral: `src/components/layout/Sidebar.tsx`
- Controle de acesso por módulo/rota: `src/lib/moduleAccess.ts`

### Recursos entregues
- Filtros por:
  - período (`24h`, `7d`, `30d`)
  - `scope`
  - severidade (`warn`/`error`)
  - tipo (`log`/`alert`)
- Tabela com mensagem e `meta` do evento
- Paginação e contagem total
- Cards rápidos de contexto (errors, warnings, alertas)

---

## Etapa 10 — Alerta externo automático

### Implementação
- Endpoint: `src/app/api/observability/alert/route.ts`
- Disparo no utilitário: `src/lib/observability.ts`

### Fluxo
1. `logError` alimenta o detector de burst por `scope`.
2. Ao atingir limiar, o sistema gera alerta local `[obs][alert]`.
3. O alerta é persistido em `observability_events`.
4. Também é enviado para `/api/observability/alert`.
5. O endpoint encaminha para webhook externo (`OBSERVABILITY_ALERT_WEBHOOK_URL`).

### Anti-ruído
- cooldown local por `scope` para envio externo (`EXTERNAL_ALERT_COOLDOWN_MS`).

---

## Variáveis de ambiente (Etapa 10)
- `OBSERVABILITY_ALERT_WEBHOOK_URL` (obrigatória para envio)
- `OBSERVABILITY_ALERT_WEBHOOK_SECRET` (opcional, header `x-observability-secret`)

> Se `OBSERVABILITY_ALERT_WEBHOOK_URL` não estiver definida, endpoint responde `ok` com `skipped=missing_webhook`.

---

## Playbook operacional (resumo)
1. Entrou alerta em webhook? Validar `scope` e janela de impacto.
2. Abrir tela `/observabilidade` com filtro do `scope` em `24h`.
3. Confirmar se erro é regressão, oscilação externa ou dados inválidos.
4. Executar correção/rollback conforme criticidade.
5. Registrar causa raiz e ação preventiva.

---

## Próximo passo recomendado
- Evoluir para alertas multicanal (WhatsApp/email) + severidade escalonada por `scope`.
