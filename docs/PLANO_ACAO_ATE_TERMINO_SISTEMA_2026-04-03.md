# Plano de ação até o término do sistema (MasterFleetBR)

> Data base: 2026-04-03
> Objetivo: concluir o sistema com prontidão de produção, governança de release e previsibilidade operacional.

---

## 1) Definição de término (Done global)

Considerar “sistema concluído” quando TODOS os critérios abaixo estiverem atendidos:

1. Fluxos críticos ponta a ponta estáveis (web + motorista + billing + suporte).
2. Gates de qualidade verdes em PR e main (`CI Quality Gates` + `Billing smoke + E2E tests`).
3. Segurança e dados críticos revisados (RLS, authz, segredos, rotas sensíveis).
4. Operação com runbooks e troubleshooting documentados.
5. Go-live controlado executado + monitoramento assistido 72h sem incidente severo aberto.

---

## 2) Plano em 5 frentes paralelas

## Frente A — Fechamento funcional (P0/P1)

### Meta
Zerar pendências de maior impacto de operação/receita.

### Escopo prioritário
- WhatsApp operacional (notificações OS/suporte e rastreio de falha).
- URL personalizada do plano Supremo (provisionamento + validação + roteamento).
- Landing master-editável e planos dinâmicos conectados ao cadastro oficial.

### Critério de aceite
- Jornada principal e exceções validadas por roteiro.
- Sem bloqueio funcional em produção para perfil empresa/master.

## Frente B — Confiabilidade e offline-first

### Meta
Garantir execução resiliente em campo (mobile + sincronização).

### Escopo prioritário
- Replay offline avançado com deduplicação e resolução de conflito.
- Métricas operacionais no app (fila, latência, taxa de erro).
- Painel de confiabilidade mínimo na web.

### Critério de aceite
- Cenários sem internet/retorno de conexão validados em homologação.

## Frente C — Billing e financeiro de produção

### Meta
Blindar receita recorrente e operação de cobrança.

### Escopo prioritário
- Concluir 2º gateway ativo (Asaas/Stripe), fallback e dunning básico.
- Validar trilha completa: geração fatura → pagamento → ativação/desbloqueio.
- Runbook de incidente financeiro (falha webhook/falha cobrança).

### Critério de aceite
- Smoke + E2E de billing verdes em PR/main + evidência de homologação.

## Frente D — Segurança, dados e observabilidade

### Meta
Reduzir risco operacional e de compliance.

### Escopo prioritário
- Revisão formal de RLS por release (tabelas críticas).
- Revisão authn/authz em rotas sensíveis.
- Alertas críticos multicanal + playbook de incidente testado.

### Critério de aceite
- Checklist de segurança assinado + alertas ativos com teste de disparo.

## Frente E — Governança de entrega e go-live

### Meta
Chegar ao release final com previsibilidade.

### Escopo prioritário
- Branch protection com gates obrigatórios.
- Checklist de release + rollback ensaiado.
- Plano de comunicação e janela de release.

### Critério de aceite
- Release concluído com monitoramento 24/72h sem severidade alta pendente.

---

## 3) Cronograma sugerido (8 semanas)

### Semana 1–2 (Fundação de fechamento)
- Congelar escopo P0/P1 por frente.
- Fechar gaps críticos de billing + governança CI (já em andamento).
- Iniciar WhatsApp operacional e URL personalizada (modelagem + MVP).

### Semana 3–4 (Entrega de valor de negócio)
- Concluir WhatsApp operacional fim a fim.
- Concluir URL personalizada (Supremo) com validação de domínio e roteamento.
- Entregar editor da landing e planos dinâmicos no painel master.

### Semana 5–6 (Confiabilidade + segurança)
- Fechar replay offline avançado e telemetria mínima.
- Executar revisão completa de RLS/authz.
- Consolidar observabilidade/alertas e testes de incidente.

### Semana 7 (Hardening + homologação)
- Rodar bateria final de smoke/E2E/roteiros manuais.
- Corrigir regressões de severidade alta/média.
- Ensaiar rollback e checklist de go-live.

### Semana 8 (Go-live assistido)
- Deploy controlado em janela definida.
- Monitoramento ativo 72h.
- Encerramento formal com termo de pronto.

---

## 4) RACI simplificado (papéis)

- **Produto/Negócio:** priorização final P0/P1 e aceite funcional.
- **Tech Lead:** arquitetura, risco técnico, decisão de corte de escopo.
- **Dev Web/Mobile:** implementação por frente e evidência de testes.
- **DB/Supabase:** migrations, RLS, RPCs, performance de consultas.
- **Operação/CS:** homologação guiada e validação de runbooks.

---

## 5) Métricas de avanço (acompanhamento semanal)

1. % de P0/P1 concluídos por frente.
2. Taxa de sucesso dos workflows críticos (CI Quality + Billing smoke/E2E).
3. Incidentes abertos por severidade (S1/S2/S3).
4. Tempo médio de correção (lead time de bug crítico).
5. Taxa de sucesso dos roteiros de homologação.

---

## 6) Riscos principais e mitigação

- Escopo excessivo próximo ao go-live
  - Mitigação: congelar P2 e priorizar apenas P0/P1.
- Regressão em billing
  - Mitigação: gates obrigatórios + smoke/e2e em PR.
- Instabilidade de integração externa (gateway/whatsapp)
  - Mitigação: fallback, retry, logging estruturado e runbook.
- Falha pós-release
  - Mitigação: rollback ensaiado + observação 72h.

---

## 7) Próximos passos imediatos (próximas 72h)

1. [x] Formalizar backlog P0/P1 final por frente (com dono e ETA).  
   Evidência: `docs/SPRINT_FECHAMENTO_1_EXECUCAO_ITENS_1_2_3.md`
2. [x] Ligar branch protection em `main` com gates mínimos (definição operacional pronta e validada).  
   Evidência: `docs/SPRINT_FECHAMENTO_1_EXECUCAO_ITENS_1_2_3.md`
3. [x] Abrir Sprint de Fechamento #1 com:
   - WhatsApp operacional (MVP produção)
   - URL personalizada (MVP Supremo)
   - Landing editor (MVP)
   Evidência: `docs/SPRINT_FECHAMENTO_1_EXECUCAO_ITENS_1_2_3.md`
4. [x] Publicar checklist de homologação único (empresa + master + motorista + billing).  
   Evidência: `docs/CHECKLIST_HOMOLOGACAO_UNICO.md`

---

## 8) Consolidação da execução única dos 5 blocos finais

- [x] Consolidação documental e operacional dos 5 blocos executada de uma única vez.
- Evidência central: `docs/FECHAMENTO_100_EXECUCAO_5_BLOCOS_2026-04-03.md`
