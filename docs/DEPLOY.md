# Deploy & Secrets

Passos recomendados para deploy das Edge Functions e aplicar migrations:

1. Login no Supabase CLI (recomendado executar no seu ambiente):

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

2. Configurar secrets para as Edge Functions (exemplo):

```bash
npx supabase secrets set MP_ACCESS_TOKEN="TEST-..." MP_WEBHOOK_SECRET="um-segredo" SUPABASE_SERVICE_ROLE_KEY="sbp_..."
```

3. Deploy das Edge Functions:

```bash
npx supabase functions deploy mp-create-pix
npx supabase functions deploy mp-webhook
npx supabase functions deploy billing-cycle
npx supabase functions deploy create-motorista
```

4. (Opcional) Aplicar migrations locais via `psql` apontando para `SUPABASE_DB_URL`:

```bash
export SUPABASE_DB_URL="postgres://user:pass@host:5432/db"
./scripts/deploy_supabase.sh
```

Notas de segurança:
- Não compartilhe `SUPABASE_SERVICE_ROLE_KEY` publicamente.
- Use tokens de teste do Mercado Pago em ambientes de teste.

CI / E2E
--
Incluí um workflow de GitHub Actions para testes E2E e um workflow agendado para rodar `billing-cycle` mensalmente.

Para habilitar no repositório, adicione os segredos no GitHub repository settings → Secrets:

- `SUPABASE_URL` — https://<project>.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` — `sbp_...`
- `MP_ACCESS_TOKEN` — token Mercado Pago (test)

Depois de configurados, você pode rodar o workflow `E2E tests` manualmente no Actions ou ao dar push na `main`.
