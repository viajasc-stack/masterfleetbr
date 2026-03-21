# Etapa 2 — Homologação passo a passo (Financeiro + Operação + Motorista)

## Objetivo
Validar os fluxos críticos ponta a ponta com evidência, antes de avançar para observabilidade/produção ampliada.

---

## 0) Pré-check de ambiente
1. Confirmar variáveis de ambiente do projeto web.
2. Subir aplicação:
   - `npm run dev`
3. Confirmar acesso com 2 perfis:
   - admin/usuário de empresa
   - motorista (app)

**Evidência:** print da home autenticada e versão/commit testado.

---

## 1) Smoke automatizado disponível no repositório

### 1.1 Smoke web crítico
- Rodar:
  - `npm run smoke:web`

Valida estrutura crítica de billing/edge calls (comportamento esperado inclusive sem credenciais reais de gateway em alguns cenários).

### 1.2 Lint escopo principal
- Rodar:
  - `npm run lint`

**Evidência:** saída do terminal sem erro bloqueante para os fluxos homologados.

---

## 2) Homologação manual — Financeiro
Base: `docs/CHECKLIST_FINANCEIRO_GO_LIVE.md`

### 2.1 Dashboard (`/financeiro`)
1. Abrir dashboard.
2. Verificar cards e seção de assinatura.
3. Abrir “Próximos vencimentos” e navegar para detalhe.

### 2.2 Contas (`/financeiro/contas`)
1. Filtrar por tipo/status.
2. Buscar por descrição/categoria.
3. Marcar conta pendente como paga/recebida.
4. Cancelar conta individual.
5. Cancelar contas em lote.

### 2.3 Nova conta (`/financeiro/contas/nova`)
1. Criar conta única a pagar.
2. Criar conta única a receber.
3. Criar carnê parcelado.
4. Forçar erro de validação (campo obrigatório vazio).

### 2.4 Detalhe (`/financeiro/contas/[id]`)
1. Abrir conta criada.
2. Registrar liquidação.
3. Cancelar conta via confirmação.

### 2.5 Assinatura e faturas
1. Abrir `/financeiro/assinatura` e alterar plano.
2. Gerar fatura manual.
3. Abrir `/financeiro/faturas`.
4. Testar PIX, cartão e boleto com validações.
5. Confirmar bloqueio de tentativa de pagamento para fatura não aberta.

**Evidência:** IDs de conta/fatura alteradas + status final no banco.

---

## 3) Homologação manual — Operação (OS/Agenda/Fretamento)

### 3.1 Ordens de serviço (`/ordens-servico`)
1. Selecionar OS e usar ação de cancelar (individual e lote).
2. Confirmar que status vira `cancelada` (sem delete físico).

### 3.2 Fretamento eventual (`/fretamentos/eventual`)
1. Cancelar um fretamento pela lista.
2. Confirmar atualização de status e feedback de sucesso.

### 3.3 Agenda (`/agenda/[date]`)
1. Cancelar OS individual do dia.
2. Cancelar lote por contrato no dia.
3. Confirmar ausência de erro de FK financeiro.

**Evidência:** registro de OS antes/depois (id + status).

---

## 4) Homologação manual — Motorista (app)
1. Login no app motorista.
2. Abrir OS pendente e iniciar execução.
3. Registrar evento básico (ex.: atualização de progresso).
4. Simular oscilação de rede (offline/online) e validar sincronização base.
5. Confirmar refletiu no painel web.

**Evidência:** OS com trilha de eventos no painel + confirmação de sincronização.

---

## 5) Critério de aprovação da Etapa 2
- Sem erro bloqueante em fluxo crítico (financeiro/OS/agenda/fretamento/motorista).
- Sem tentativa de `delete` físico em `ordens_servico` pelos fluxos de UI homologados.
- Logs/evidências registradas para cada bloco.

---

## 6) Registro final (preencher ao concluir)
- Commit/branch testado:
- Ambiente testado:
- Responsável:
- Pendências encontradas:
- Decisão: `Aprovado` / `Aprovado com ressalvas` / `Reprovado`
