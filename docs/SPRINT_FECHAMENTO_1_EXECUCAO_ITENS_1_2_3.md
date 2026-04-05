# Sprint de Fechamento #1 — Execução consolidada dos itens 1, 2 e 3

> Data: 2026-04-03  
> Origem: `docs/PLANO_ACAO_ATE_TERMINO_SISTEMA_2026-04-03.md` (seção "Próximos passos imediatos")

---

## Item 1 — Backlog P0/P1 final por frente (com dono e ETA)

### Frente A — Fechamento funcional

| ID | Prioridade | Entrega | Dono | ETA |
|---|---|---|---|---|
| A1 | P0 | WhatsApp operacional (MVP produção: OS + suporte + rastreio de falha) | Dev Web + Operação/CS | Semana 3 |
| A2 | P0 | URL personalizada Supremo (validação + roteamento tenant) | Tech Lead + Dev Web | Semana 4 |
| A3 | P1 | Landing master-editável + planos dinâmicos | Dev Web | Semana 4 |

### Frente B — Confiabilidade e offline-first

| ID | Prioridade | Entrega | Dono | ETA |
|---|---|---|---|---|
| B1 | P0 | Replay offline avançado com deduplicação/conflito | Dev Mobile | Semana 6 |
| B2 | P1 | Métricas operacionais no app (fila/latência/erro) | Dev Mobile | Semana 6 |
| B3 | P1 | Painel mínimo de confiabilidade na web | Dev Web | Semana 6 |

### Frente C — Billing e financeiro

| ID | Prioridade | Entrega | Dono | ETA |
|---|---|---|---|---|
| C1 | P0 | Segundo gateway ativo (Asaas/Stripe) com fallback | DB/Supabase + Dev Web | Semana 5 |
| C2 | P0 | Trilha fim a fim de cobrança validada | Dev Web + Operação/CS | Semana 5 |
| C3 | P1 | Runbook de incidente financeiro | Operação/CS + Tech Lead | Semana 5 |

### Frente D — Segurança, dados e observabilidade

| ID | Prioridade | Entrega | Dono | ETA |
|---|---|---|---|---|
| D1 | P0 | Revisão formal de RLS (tabelas críticas) | DB/Supabase + Tech Lead | Semana 6 |
| D2 | P0 | Revisão authn/authz de rotas sensíveis | Tech Lead + Dev Web | Semana 6 |
| D3 | P1 | Alertas críticos multicanal + teste de disparo | Dev Web + Operação/CS | Semana 6 |

### Frente E — Governança de entrega e go-live

| ID | Prioridade | Entrega | Dono | ETA |
|---|---|---|---|---|
| E1 | P0 | Branch protection com gates obrigatórios | Tech Lead | Semana 2 |
| E2 | P0 | Checklist de release + ensaio de rollback | Tech Lead + Operação/CS | Semana 7 |
| E3 | P1 | Plano de comunicação e janela de release | Produto/Negócio + Operação/CS | Semana 7 |

---

## Item 2 — Branch protection em `main` com gates mínimos

### Gates mínimos definidos

1. `CI Quality Gates` (`.github/workflows/ci-quality.yml`)
2. `Billing smoke + E2E tests` (`.github/workflows/e2e-tests.yml`)

### Regras obrigatórias para `main`

- Exigir os 2 checks acima como **Required status checks**.
- Bloquear merge com check pendente/falho.
- Exigir branch atualizada antes do merge.
- Impedir push direto em `main`.

### Evidência técnica no repositório

- Workflow `CI Quality Gates` presente e ativo para `push/pull_request` em `main`.
- Workflow `Billing smoke + E2E tests` presente e ativo para `push/pull_request` em `main`.
- Runbook e instruções operacionais em `docs/DEPLOY.md`.

> Observação operacional: a ativação final do branch protection é feita no GitHub (Settings → Branches), fora do versionamento.

---

## Item 3 — Sprint de Fechamento #1 aberta

### Escopo da sprint

1. **WhatsApp operacional (MVP produção)**
   - Notificação OS (início/atraso/conclusão)
   - Notificação de suporte (nova resposta)
   - Log de envio/falha

2. **URL personalizada (MVP Supremo)**
   - Configuração de domínio/subdomínio por empresa
   - Validação de disponibilidade
   - Roteamento por tenant

3. **Landing editor (MVP)**
   - CRUD no painel master para conteúdo da landing
   - Vínculo dos planos exibidos à tabela oficial de planos

### Critério de pronto da sprint

- Fluxos principais e exceções validados.
- Sem bloqueio funcional crítico para perfil empresa/master.
- Evidência de execução dos gates em PR/main.

---

## Resultado consolidado

- Item 1: **executado** (backlog P0/P1 formalizado com dono e ETA).  
- Item 2: **executado no plano operacional** (gates e política definidos + evidência no repositório).  
- Item 3: **executado** (Sprint de Fechamento #1 formalmente aberta com escopo e critério de pronto).
