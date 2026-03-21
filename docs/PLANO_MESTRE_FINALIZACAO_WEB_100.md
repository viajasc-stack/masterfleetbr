# Plano Mestre — Finalização Web 100% (MasterFleetBR)

> Objetivo: concluir o sistema web com nível de produção (funcional, estável, seguro, observável e operacional), com execução orientada por checklist e critérios de aceite.

---

## 1) Definição de “100% concluído” (DoD Global)

O projeto só é considerado 100% quando **todos** os itens abaixo estiverem atendidos:

1. **Funcionalidade**
   - Todos os módulos web críticos operando ponta a ponta
   - Fluxos de cadastro, operação, financeiro, suporte e configurações sem bloqueios
2. **Qualidade**
   - Lint/Typecheck/Build verdes
   - Testes de fumaça críticos verdes
3. **Banco e Regras**
   - Migrations consistentes e aplicadas
   - RLS e permissões validadas por perfil
4. **Segurança**
   - Segredos fora do código
   - Rotas críticas com validação/autorização
5. **Observabilidade e Incidente**
   - Logs críticos persistidos
   - Alertas multicanal ativos
   - Playbook de incidente testado
6. **Go-live operacional**
   - Checklist de deploy
   - Rollback testado
   - Monitoramento pós-release

---

## 2) Fases de execução (sequência recomendada)

## Fase A — Gap Analysis total (raio-x final)
- Inventário de telas, APIs, jobs, funções Supabase, permissões e integrações
- Matriz “Implementado / Parcial / Faltando / Bloqueado”
- Priorização por impacto (receita, operação diária, risco)

**Entrega:** backlog final priorizado com estimativa e dependências.

## Fase B — Fechamento funcional por módulos
- Dashboard/Operação (OS, viagens, agenda, motorista)
- Cadastros base (clientes, veículos, motoristas, usuários)
- Financeiro (contas, cobrança, assinatura/faturas)
- Suporte/atendimento
- Configurações e integrações (Google, WhatsApp, etc.)

**Regra:** cada módulo só fecha com teste de fluxo principal e de exceção.

## Fase C — Integridade de dados e segurança
- Revisão de migrations pendentes
- Revisão de RLS por tabela crítica
- Auditoria de rotas server/API (authn/authz/input validation)
- Hardening de segredos e variáveis de ambiente

## Fase D — Qualidade técnica e performance
- Padronização de erros
- Eliminação de warnings relevantes
- Otimização de queries e carregamento de páginas críticas
- Teste de fumaça dos fluxos mais usados

## Fase E — Operação e go-live
- Checklist final de produção
- Janela de deploy e plano de rollback
- Observação assistida 24–72h pós-release

---

## 3) Backlog final pronto para execução (macro)

1. **Consolidar matriz de lacunas por módulo**
2. **Fechar pendências P0/P1 de funcionalidade**
3. **Cobrir rotas/tabelas críticas com validação de segurança**
4. **Completar testes e smoke e2e mínimos**
5. **Finalizar documentação operacional e runbooks**
6. **Executar go-live controlado e monitoramento**

---

## 4) Critérios de aceite por pacote (Definition of Ready/Done)

Para iniciar um pacote:
- Requisito claro + impacto + dono
- Dependências resolvidas

Para concluir um pacote:
- Código + migration (quando aplicável)
- Evidência de teste (lint/build/smoke)
- Atualização de documentação
- Sem regressão no fluxo crítico relacionado

---

## 5) Modelo de execução “quase 1 comando” (com governança)

Você dispara um comando de ciclo e eu executo o lote definido:

1. Ler backlog priorizado
2. Implementar bloco de tarefas
3. Rodar validações automáticas
4. Corrigir falhas detectadas
5. Entregar relatório objetivo + próximo lote

**Comando operacional sugerido (processo):**
- `Executar Lote Web 100% - Sprint N`

> Observação: ainda exige checkpoints curtos de aprovação para mudanças sensíveis (produção, billing, regras críticas).

---

## 6) Riscos e mitigação

- **Risco:** requisito implícito não documentado
  - **Mitigação:** checkpoint funcional por módulo
- **Risco:** regressão em fluxo antigo
  - **Mitigação:** smoke tests por jornada crítica
- **Risco:** falha pós-deploy
  - **Mitigação:** rollback ensaiado + observabilidade ativa

---

## 7) Plano de fechamento em 3 ondas

## Onda 1 (Alta prioridade)
- Pendências P0/P1 de operação e financeiro
- Segurança e permissões
- Correções impeditivas de produção

## Onda 2 (Estabilização)
- Performance das páginas críticas
- UX de erros e consistência de estado
- Cobertura de testes principais

## Onda 3 (Selo 100%)
- Documentação final
- Go-live checklist completo
- Homologação final + termo de pronto

---

## 8) Checklist executivo (acompanhamento)

- [ ] Gap analysis concluído e aprovado
- [ ] Backlog final P0/P1/P2 fechado
- [ ] Pendências P0 e P1 implementadas
- [ ] Lint + typecheck + build verdes
- [ ] Smoke crítico aprovado
- [ ] Segurança/RLS revisadas
- [ ] Observabilidade e alertas ativos
- [ ] Documentação operacional finalizada
- [ ] Deploy + rollback testados
- [ ] Homologação final concluída

---

## 9) Próximo passo imediato (já preparado)

1. Executar **Fase A (Gap Analysis total)** agora
2. Em seguida abrir **Lote 1 de fechamento P0/P1**
3. Iterar lote a lote até zerar checklist executivo

Com isso, o plano já está pronto para nos levar ao **100% funcional com controle de risco**.
