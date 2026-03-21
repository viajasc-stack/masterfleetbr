# Etapa 5 — Expansão de observabilidade em fluxos críticos

## Objetivo
Expandir o padrão de observabilidade das etapas 3/4 para novos pontos de risco operacional e financeiro.

## Escopo aplicado

### 1) Financeiro · Contas (lista)
Arquivo: `src/app/(painel)/financeiro/contas/page.tsx`

Eventos instrumentados:
- falha ao carregar contas
- exclusão individual (erro/sucesso)
- exclusão em lote (erro/sucesso)
- marcação de liquidação (erro/sucesso)

Scope usado: `financeiro.contas`

### 2) Financeiro · Conta detalhe
Arquivo: `src/app/(painel)/financeiro/contas/[id]/page.tsx`

Eventos instrumentados:
- falha ao carregar conta
- registrar liquidação (erro/sucesso)
- cancelar conta (erro/sucesso)

Scope usado: `financeiro.contas_detalhe`

### 3) Operação · Agenda do dia
Arquivo: `src/app/(painel)/agenda/[date]/page.tsx`

Eventos instrumentados:
- falha ao carregar agenda do dia
- mover OS individual (erro/sucesso)
- cancelar OS individual (erro/sucesso)
- mover lote por contrato (erro/sucesso)
- cancelar lote por contrato (erro/sucesso)

Scope usado: `operacao.agenda_dia`

## Resultado esperado
- Mais rastreabilidade sem expor dados sensíveis (mascaramento já ativo no utilitário).
- Diagnóstico mais rápido em incidentes de financeiro e operação diária.

## Próximo passo sugerido (Etapa 6)
- Expandir mesma abordagem para:
  - `financeiro/assinatura`
  - `financeiro/contas/nova`
  - `fretamentos/eventual`
  - `orcamentos`
