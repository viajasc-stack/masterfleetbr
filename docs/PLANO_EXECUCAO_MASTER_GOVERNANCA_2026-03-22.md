# Plano de Execução — Painel Master (Governança Completa)

## Objetivo
Evoluir o Painel Master para controle executivo completo de operação, receita, risco, compliance e ativação de clientes.

## Sprint 1 (P0) — em execução
- [x] Central de saúde da plataforma (base de dados + RPC)
- [x] Ações em massa por empresa (base de dados + RPC)
- [x] Timeline de auditoria por empresa (base de dados + RPC)
- [x] Score de risco/churn (base de dados + RPC)
- [ ] UI de saúde operacional
- [ ] UI de auditoria
- [ ] UI de risco
- [ ] UI de ações em massa em empresas

## Sprint 2 (P1) — iniciado (estrutura pronta)
- [x] CRM de contas (pipeline)
- [x] Comunicação em massa (broadcast)
- [x] Rollout progressivo de features
- [x] Cobrança avançada (negociações)
- [ ] UI consolidada de governança (pipeline/comunicação/rollout/cobrança)

## Sprint 3 (P2) — iniciado (estrutura pronta)
- [x] Data room executivo (métricas consolidadas)
- [x] Base de conhecimento + macros de suporte
- [x] LGPD (solicitações e rastreabilidade)
- [x] Onboarding score por empresa
- [ ] UI consolidada para P2

## Entregáveis técnicos já iniciados
- Migration: `20260322052000_master_execucao_governanca_expandida.sql`
- Novas entidades: auditoria, pipeline, broadcast, rollout, negociação, KB, macros, LGPD, onboarding score
- Novas RPCs de leitura/escrita para todas as frentes acima

## Próximo passo imediato
Publicar interfaces no painel master para operação diária das frentes P0/P1/P2 e validar fluxo fim a fim com build/lint.
