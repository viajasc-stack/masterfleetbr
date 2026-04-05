# Etapa 4 — Execução integrada (Segurança + Performance + Go-live + Testes)

## Objetivo
Consolidar uma etapa única para fechar lacunas finais antes de escala, cobrindo os 4 blocos pedidos.

---

## A) Hardening de segurança

### Implementado nesta etapa
1. **Sanitização de dados sensíveis em logs**
   - Arquivo: `src/lib/observability.ts`
   - Campos mascarados: `authorization`, `token`, `access_token`, `refresh_token`, `password`, `senha`, `cvv`, `card_number`, `number`.

2. **Padronização de logs em ações críticas**
   - Financeiro faturas + operação OS seguem utilitário central com metadados controlados.

### Checklist operacional
- [ ] Validar que nenhum token/cvv aparece em logs do browser.
- [ ] Revisar variáveis sensíveis no deploy (produção/preview).
- [ ] Rodar rotação periódica de segredos (ver docs de rotate).

---

## B) Performance e UX (telas críticas)

### Implementado nesta etapa
1. **Memoização de filtros pesados em OS**
   - Arquivo: `src/app/(painel)/ordens-servico/page.tsx`
   - Uso de `useMemo` para reduzir recomputação de lista filtrada.

### Checklist operacional
- [ ] Confirmar fluidez com listas maiores (100+ OS).
- [ ] Medir tempo de interação ao aplicar busca/filtro.
- [ ] Validar ausência de regressão visual nas ações de cancelar.

---

## C) Go-live controlado

### Procedimento recomendado
1. Publicar em janela controlada.
2. Monitorar 30–60 min pós-deploy:
   - billing/pagamentos
   - cancelamento de OS
   - webhooks
3. Critério de rollback:
   - erro crítico em pagamento, autenticação ou OS sem workaround.

### Comandos úteis
- `npm run lint:critical`
- `npm run smoke:web`
- `npm run verify:etapa4`

> `smoke:web` depende de `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

### Observações do smoke crítico (atualizado)
- O script `scripts/smoke_web_critical.js` agora é **idempotente**:
  - reutiliza empresa/assinatura/fatura quando já existem;
  - evita falhas por conflito em reexecuções.
- Variável opcional suportada:
  - `SMOKE_EMPRESA_EMAIL` (default: `smoke.web.critical@example.com`).
- No cenário PIX sem credenciais/gateway completos, o script aceita apenas erros esperados
  (ex.: `internal_error`, `unauthorized`, `gateway`, `fatura não encontrada`) e falha para erros inesperados.

---

## D) Testes automatizados e validação rápida

### Scripts disponíveis
- `scripts/smoke_web_critical.js`
- `scripts/e2e_test.js`
- `scripts/test_orcamento.js`

### Estratégia mínima
1. Antes do deploy: `npm run lint:critical`
2. Antes do deploy: `npm run smoke:web`
3. Pós deploy: validar roteiro manual de Etapa 2 + logs da Etapa 3.

### Exemplos de execução local
```bash
# smoke crítico com e-mail padrão idempotente
npm run smoke:web

# smoke crítico com e-mail isolado por ambiente
SMOKE_EMPRESA_EMAIL="smoke.web.hml@example.com" npm run smoke:web

# e2e billing com e-mail estável (idempotente)
E2E_EMPRESA_EMAIL="e2e.billing.hml@example.com" node scripts/e2e_test.js
```

---

## Fechamento da Etapa 4
- Segurança: baseline com mascaramento de dados sensíveis em logs.
- Performance: otimização aplicada no fluxo crítico de listagem OS.
- Go-live: comando e protocolo objetivo definidos.
- Testes: trilha automatizada mínima encadeada (`verify:etapa4`).

## Decisões adotadas (registro rápido)

1. **Idempotência como padrão para validações operacionais**
   - `scripts/smoke_web_critical.js` e `scripts/e2e_test.js` foram ajustados para reuso de dados em reexecuções.
   - Objetivo: reduzir ruído de teste e evitar falhas por conflito de inserção.

2. **Gates mínimos de qualidade em PR para `main`**
   - `CI Quality Gates` + `Billing smoke + E2E tests` como checks mínimos recomendados.
   - Objetivo: bloquear regressão funcional de billing antes do merge.

3. **Critério de aceite operacional explícito**
   - smoke sem erro inesperado;
   - e2e com assinatura final `ativa` e `billing_model: modular`.
   - Objetivo: padronizar decisão de aprovação técnica.
