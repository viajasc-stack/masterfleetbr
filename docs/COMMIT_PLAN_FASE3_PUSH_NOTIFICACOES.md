# Plano de commits — Fase 3 (Push + Notificações Motorista)

Este plano separa os commits em blocos pequenos, revisáveis e com baixo risco.

> Observação: existem alterações não relacionadas no repositório (`src/app/(painel)/clientes/novo/page.tsx` e `src/app/api/cnpj/[cnpj]/route.ts`).
> Use `git add <arquivo>` (não `git add .`) para evitar misturar escopos.

---

## Commit 1 — Base de tokens push no banco

Arquivos:

- `supabase/migrations/20260315053000_create_motorista_push_tokens.sql`

Comandos:

```bash
git add supabase/migrations/20260315053000_create_motorista_push_tokens.sql
git commit -m "feat(push): criar tabela motorista_push_tokens com RLS e trigger"
```

---

## Commit 2 — Outbox push + enqueue automático por notifications

Arquivos:

- `supabase/migrations/20260315060000_push_dispatch_notifications.sql`

Comandos:

```bash
git add supabase/migrations/20260315060000_push_dispatch_notifications.sql
git commit -m "feat(push): adicionar motorista_push_outbox e trigger de enqueue por notifications"
```

---

## Commit 3 — Dispatcher push (edge function) + scheduler

Arquivos:

- `supabase/functions/push-dispatch/index.ts`
- `.github/workflows/schedule-push-dispatch.yml`

Comandos:

```bash
git add supabase/functions/push-dispatch/index.ts .github/workflows/schedule-push-dispatch.yml
git commit -m "feat(push): implementar push-dispatch com retry/backoff e scheduler github actions"
```

---

## Commit 4 — Eventos de OS para notificação/push

Arquivos:

- `supabase/migrations/20260315070000_notifications_os_events_for_motorista_push.sql`

Comandos:

```bash
git add supabase/migrations/20260315070000_notifications_os_events_for_motorista_push.sql
git commit -m "feat(notifications): gerar eventos nova_os e alteracao_os via triggers em ordens_servico"
```

---

## Commit 5 — Refino da tela de Notificações (Fase 3.2)

Arquivos:

- `masterfleetbr-motorista/src/screens/NotificacoesScreen.tsx`

Comandos:

```bash
git add masterfleetbr-motorista/src/screens/NotificacoesScreen.tsx
git commit -m "feat(motorista): adicionar busca/filtro no feed de notificacoes pendentes"
```

---

## Commit 6 — Documentação operacional

Arquivos:

- `docs/EDGE_FUNCTIONS.md`
- `docs/STATUS_FASE2_APP_MOTORISTA_2026-03-15.md`
- `docs/PUSH_FIM_A_FIM_CHECKLIST_DEPLOY.md`

Comandos:

```bash
git add docs/EDGE_FUNCTIONS.md docs/STATUS_FASE2_APP_MOTORISTA_2026-03-15.md docs/PUSH_FIM_A_FIM_CHECKLIST_DEPLOY.md
git commit -m "docs(push): atualizar edge functions, status da fase e checklist de deploy fim-a-fim"
```

---

## Push final

```bash
git push origin HEAD
```
