# Checklist Único de Homologação — Empresa + Master + Motorista + Billing

> Versão: 2026-04-03  
> Objetivo: concentrar, em um único roteiro, os testes mínimos para validação pré-go-live.

---

## Template operacional de sessão (uso recorrente)

> Preencher este bloco no início/fim de **cada rodada de homologação**.

### Identificação da rodada

- Data:
- Janela (início/fim):
- Ambiente (hml/staging/prod assistido):
- Commit/branch:
- Responsável técnico:
- Participantes (Produto/CS/QA):

### Escopo da rodada

- [ ] Empresa
- [ ] Master
- [ ] Motorista
- [ ] Billing
- Observações de escopo:

### Resultado da rodada

- Decisão:
  - [ ] Aprovado
  - [ ] Aprovado com ressalvas
  - [ ] Reprovado
- Resumo executivo (3–5 linhas):
- Incidentes encontrados (ID/severidade/status):
- Ações imediatas (owner + ETA):
- Data da próxima rodada:

---

## 0) Pré-check obrigatório

- [ ] Ambiente com variáveis configuradas (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)
- [ ] Aplicação web acessível e autenticando normalmente
- [ ] App motorista autenticando com usuário válido
- [ ] Banco de homologação com migrations atualizadas

**Evidência:** commit/branch testado + ambiente + responsável.

---

## 1) Gates automatizados (obrigatório)

### 1.1 Qualidade
- [ ] `CI Quality Gates` verde em PR/main

### 1.2 Billing crítico
- [ ] `Billing smoke + E2E tests` verde em PR/main
- [ ] `npm run smoke:web` sem erro inesperado
- [ ] `node scripts/e2e_test.js` com assinatura final `ativa` e `billing_model: modular`

**Evidência:** links dos workflows + logs principais.

---

## 2) Homologação módulo Empresa (painel)

### 2.1 Operação (OS / Agenda / Fretamento)
- [ ] Cancelamento individual e em lote em OS funcionando (status `cancelada`, sem delete físico)
- [ ] Cancelamento de fretamento eventual com status atualizado
- [ ] Cancelamento na agenda sem erro de vínculo financeiro

### 2.2 Financeiro
- [ ] Dashboard financeiro carrega com cards e assinatura
- [ ] Contas: filtros, busca, baixa e cancelamento (individual/lote)
- [ ] Nova conta: criação única/pagar/receber e carnê com validação
- [ ] Assinatura: troca de plano + geração manual de fatura
- [ ] Faturas: PIX/cartão/boleto com validações e bloqueio para fatura não aberta

### 2.3 Suporte (empresa)
- [ ] Abertura de ticket
- [ ] Resposta em ticket aberto
- [ ] Ticket fechado bloqueia nova resposta
- [ ] Indicador de não lidas funcionando

**Evidência:** IDs de OS/contas/faturas/tickets com status antes/depois.

---

## 3) Homologação módulo Master

- [ ] Dashboard master carregando sem erro
- [ ] Gestão de empresas (listar/detalhar/editar) sem erro de permissão
- [ ] Gestão de planos e módulos carregando e persistindo alterações esperadas
- [ ] Suporte master: fila, detalhe, resposta, status/prioridade
- [ ] Indicador de não lidas no suporte master consistente com tickets da empresa

**Evidência:** IDs de empresa/ticket alterados + prints de telas críticas.

---

## 4) Homologação App Motorista

- [ ] Login no app motorista
- [ ] Início de OS pendente e envio de evento operacional
- [ ] Simulação offline/online com sincronização validada
- [ ] Reflexo dos eventos no painel web

**Evidência:** OS com trilha de eventos e horário de sincronização.

---

## 5) Critério único de aprovação

- [ ] Sem erro bloqueante nos fluxos críticos (empresa + master + motorista + billing)
- [ ] Sem regressão de segurança/autorização em rotas sensíveis
- [ ] Sem regressão crítica de cobrança/pagamento
- [ ] Evidências registradas por bloco

### Decisão final

- [ ] **Aprovado**
- [ ] **Aprovado com ressalvas**
- [ ] **Reprovado**

Campos de fechamento:
- Commit/branch:
- Ambiente:
- Responsável:
- Pendências:
