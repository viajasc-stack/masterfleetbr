# MasterFleet BR — Web + Billing

Aplicação web (Next.js) com módulos operacionais e esteira de billing integrada com Supabase.

## Requisitos

- Node.js 20+
- NPM
- Variáveis de ambiente em `.env.local` para Supabase (mínimo para smoke/e2e):
  - `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY`

## Desenvolvimento local

```bash
npm ci
npm run dev
```

## Scripts principais

- `npm run lint` — lint geral.
- `npm run build` — build de produção.
- `npm run ci:verify` — lint + build (gate base).
- `npm run smoke:web` — smoke crítico de billing/suporte via service role.
- `npm run verify:etapa4` — lint crítico + smoke web.

## Smoke e E2E de billing

### Smoke crítico (idempotente)

```bash
npm run smoke:web
```

Variável opcional:
- `SMOKE_EMPRESA_EMAIL` (default: `smoke.web.critical@example.com`)

### E2E billing

```bash
node scripts/e2e_test.js
```

Variável opcional:
- `E2E_EMPRESA_EMAIL` (default: `e2e.billing@example.com`)

## CI (GitHub Actions)

Workflow principal de billing:
- **Nome:** `Billing smoke + E2E tests`
- **Arquivo:** `.github/workflows/e2e-tests.yml`
- **Gatilhos:**
  - `workflow_dispatch`
  - `push` em `main`
  - `pull_request` em `main`

Pipeline executado:
1. `npm run smoke:web`
2. `node ./scripts/e2e_test.js`

Secrets obrigatórios no repositório:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MP_ACCESS_TOKEN`

> Para operação do dia a dia (runbook, troubleshooting, branch protection e lista completa de workflows), consulte `docs/DEPLOY.md`.

## Status da esteira (pronto para produção)

- [x] Smoke crítico com comportamento idempotente.
- [x] E2E billing com validações de resposta e reuso de dados.
- [x] Workflow de billing cobrindo `push` e `pull_request` em `main`.
- [x] Documentação operacional atualizada (`docs/DEPLOY.md` e `docs/ETAPA4_EXECUCAO_INTEGRADA.md`).

## Referências

- Deploy e segredos: `docs/DEPLOY.md`
- Etapa 4 (execução integrada): `docs/ETAPA4_EXECUCAO_INTEGRADA.md`
