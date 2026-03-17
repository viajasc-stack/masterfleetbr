# Checklist de Deploy — Push fim-a-fim (App Motorista)

## 1) Aplicar migrations

No projeto Supabase já linkado:

```bash
npx supabase db push
```

> Se preferir SQL Editor manual, execute as migrations:
> - `20260315053000_create_motorista_push_tokens.sql`
> - `20260315060000_push_dispatch_notifications.sql`
> - `20260315070000_notifications_os_events_for_motorista_push.sql`
> - `20260315080000_create_os_checklist_execucao.sql`
> - `20260315083000_enforce_os_checklist_and_evidence_rules.sql`

---

## 2) Deploy da Edge Function

```bash
npx supabase functions deploy push-dispatch --no-verify-jwt
```

---

## 3) Configurar secrets

### Supabase (Edge Function)

```bash
npx supabase secrets set PUSH_BATCH_LIMIT=50
npx supabase secrets set PUSH_DISPATCH_SECRET="defina-um-token-forte"
```

### GitHub Actions (repo secrets)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUSH_DISPATCH_SECRET` (mesmo valor do Supabase secret)

Workflow usado: `.github/workflows/schedule-push-dispatch.yml`

---

## 4) Teste operacional rápido (fim-a-fim)

1. Garanta um motorista com token em `motorista_push_tokens` (ativo=true).
2. Gere uma notificação de teste:

```sql
insert into public.notifications (empresa_id, nivel, titulo, mensagem, meta)
values (
  '<EMPRESA_ID>',
  'info',
  'Teste push motorista',
  'Mensagem de teste do dispatcher push',
  jsonb_build_object('tipo', 'mensagens')
);
```

3. Dispare manualmente o dispatcher:

```bash
curl -sS -X POST "${SUPABASE_URL}/functions/v1/push-dispatch" \
  -H "Authorization: Bearer ${PUSH_DISPATCH_SECRET}" \
  -H "Content-Type: application/json" \
  --data '{}'
```

4. Verifique resultado:

```sql
select id, status, attempts, last_error, provider_ticket_id, sent_at, created_at
from public.motorista_push_outbox
order by created_at desc
limit 20;
```

---

## 5) Validações de produção

- Confirmar que notificações com `meta.tipo` = `nova_os` e `alteracao_os` estão sendo geradas por triggers da `ordens_servico`.
- Confirmar que `critical` ignora preferência e sempre envia.
- Monitorar itens `failed` e `last_error` na `motorista_push_outbox`.
- Em caso de `DeviceNotRegistered`, validar token sendo marcado como `ativo=false`.
