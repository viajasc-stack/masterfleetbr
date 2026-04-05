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
Incluí um workflow de GitHub Actions para **billing smoke + E2E** e um workflow agendado para rodar `billing-cycle` mensalmente.

Para habilitar no repositório, adicione os segredos no GitHub repository settings → Secrets:

- `SUPABASE_URL` — https://<project>.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` — `sbp_...`
- `MP_ACCESS_TOKEN` — token Mercado Pago (test)

Depois de configurados, você pode rodar o workflow `Billing smoke + E2E tests` manualmente no Actions ou via `push`/`pull_request` na `main`.

Workflow de billing/E2E:
- Arquivo: `.github/workflows/e2e-tests.yml`
- Nome: `Billing smoke + E2E tests`
- Gatilhos:
  - `workflow_dispatch`
  - `push` em `main`
  - `pull_request` em `main`
- Execução:
  1. `npm run smoke:web`
  2. `node ./scripts/e2e_test.js`

Variáveis opcionais para isolamento/idempotência (já definidas no workflow):
- `SMOKE_EMPRESA_EMAIL`
- `E2E_EMPRESA_EMAIL`

## Go-live técnico do pipeline (billing smoke + E2E)

Checklist rápido antes de habilitar como gate de merge:

- [ ] Secrets configurados no GitHub Actions:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MP_ACCESS_TOKEN`
- [ ] Projeto Supabase de teste/homolog com schema atualizado (migrations aplicadas)
- [ ] Edge Functions necessárias implantadas e operacionais (`mp-create-payment`, `mp-create-pix`)
- [ ] Execução manual do workflow com sucesso (`workflow_dispatch`)
- [ ] Execução em PR para `main` com sucesso (`pull_request`)
- [ ] Critério de aprovação definido:
  - smoke OK
  - e2e OK
  - sem erro inesperado de autenticação/infra

## Troubleshooting rápido (CI)

### 1) Falha: `Missing SUPABASE_URL...` ou `SUPABASE_SERVICE_ROLE_KEY`
- Verifique se os secrets existem no repositório correto.
- Confirme nome exato (case-sensitive):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 2) Falha no smoke em `mp-create-payment`
- Validar deploy da edge function `mp-create-payment`.
- Conferir se `SUPABASE_URL` aponta para o projeto esperado (hml/test).
- Confirmar permissões válidas da `service_role` atual.

### 3) Falha no e2e em `admin_mark_paid`
- Validar se a RPC `admin_mark_paid` está presente no banco alvo.
- Confirmar migrations aplicadas no ambiente usado pelo CI.

### 4) Erro de PIX no smoke
- O smoke tolera apenas erros esperados de gateway/credenciais em ambiente de teste.
- Se aparecer erro inesperado, tratar como regressão e investigar logs da função `mp-create-pix`.

### 5) Dados “sujos” entre execuções
- O workflow usa e-mails fixos de CI para reduzir ruído e manter idempotência.
- Se necessário, altere temporariamente:
  - `SMOKE_EMPRESA_EMAIL`
  - `E2E_EMPRESA_EMAIL`

## Workflows operacionais (referência rápida)

- `Billing smoke + E2E tests`
  - Arquivo: `.github/workflows/e2e-tests.yml`
  - Objetivo: validar fluxo crítico de billing (smoke + e2e)
  - Gatilhos: `workflow_dispatch`, `push(main)`, `pull_request(main)`

- `CI Quality Gates`
  - Arquivo: `.github/workflows/ci-quality.yml`
  - Objetivo: gates de qualidade (lint + build)
  - Gatilhos: `workflow_dispatch`, `push(main)`, `pull_request(main)`

- `schedule-billing`
  - Arquivo: `.github/workflows/schedule-billing.yml`
  - Objetivo: execução agendada do ciclo de cobrança

- `E2E Orçamento`
  - Arquivo: `.github/workflows/e2e-orcamento.yml`
  - Objetivo: validação E2E do fluxo de orçamento
  - Gatilhos: `workflow_dispatch`, `push(main)`

- `Scheduled push-dispatch`
  - Arquivo: `.github/workflows/schedule-push-dispatch.yml`
  - Objetivo: despacho de notificações push (job agendado)
  - Gatilhos: `workflow_dispatch`, `schedule (*/5 * * * *)`

- `Scheduled whatsapp-dispatch`
  - Arquivo: `.github/workflows/schedule-whatsapp-dispatch.yml`
  - Objetivo: despacho WhatsApp (job agendado)
  - Gatilhos: `workflow_dispatch`, `schedule (*/5 * * * *)`

## Branch protection (sugestão objetiva)

Para `main`, exigir no mínimo:

1. `CI Quality Gates` (obrigatório)
2. `Billing smoke + E2E tests` (obrigatório)

Configuração recomendada adicional:
- bloquear merge com checks pendentes/falhos;
- exigir branch atualizada antes do merge;
- impedir push direto em `main`.

## Runbook curto pós-merge (copiar/colar)

1. Verificar status dos workflows no GitHub Actions:
   - `CI Quality Gates`
   - `Billing smoke + E2E tests`
2. Se necessário, reexecutar manualmente o billing:
   - Actions → `Billing smoke + E2E tests` → `Run workflow`
3. Validar localmente com ambiente configurado:

```bash
set -a; source .env.local >/dev/null 2>&1; set +a
npm run smoke:web
node scripts/e2e_test.js
```

4. Critério de aceite operacional:
   - smoke concluído sem erro inesperado;
   - e2e concluído com assinatura `ativa` e `billing_model: modular`.
