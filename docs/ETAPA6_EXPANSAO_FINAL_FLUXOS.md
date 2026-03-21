# Etapa 6 — Expansão final de observabilidade (fluxos adicionais)

## Objetivo
Completar a cobertura inicial dos fluxos críticos restantes após as Etapas 3–5.

## Módulos cobertos nesta etapa

### 1) Financeiro · Nova conta
Arquivo: `src/app/(painel)/financeiro/contas/nova/page.tsx`

Scope: `financeiro.contas_nova`

Eventos registrados:
- erro ao salvar conta/carnê
- exceção inesperada ao salvar
- sucesso no salvamento com metadados (tipo, modo, quantidade de parcelas)

### 2) Financeiro · Assinatura
Arquivo: `src/app/(painel)/financeiro/assinatura/page.tsx`

Scope: `financeiro.assinatura`

Eventos registrados:
- falha ao carregar billing/plano
- erro na troca de plano
- erro de recarga pós troca
- sucesso na troca de plano
- erro na geração de fatura manual
- erro de recarga pós geração
- sucesso na geração de fatura manual

### 3) Operação · Fretamento eventual
Arquivo: `src/app/(painel)/fretamentos/eventual/page.tsx`

Scope: `operacao.fretamento_eventual`

Eventos registrados:
- falha ao carregar listagem
- erro no cancelamento
- sucesso no cancelamento

## Resultado consolidado
- Cadeia de observabilidade ampliada para financeiro e operação sem expor dados sensíveis.
- Melhor capacidade de diagnóstico para incidentes de cadastro financeiro, assinatura e fretamento.

## Próximo passo sugerido (Etapa 7)
- Consolidar dashboard master de observabilidade por `scope` e severidade.
- Definir gatilhos de alerta para picos de erro por módulo crítico.
