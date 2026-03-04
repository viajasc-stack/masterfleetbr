# MasterFleetBR — Roadmap de Lançamento (foco em encantar empresas)

> Escopo aprovado agora: **Pilares 1, 2 e 3**
> 
> - ✅ Inteligência operacional
> - ✅ Plataforma ponta a ponta
> - ✅ Offline-first e confiabilidade
> - ⛔ (por enquanto) Ecossistema/marketplace
> - ⛔ (por enquanto) Go-to-market avançado

---

## Objetivo do lançamento

Entregar uma experiência que, já no primeiro contato, mostre:

1. **Controle em tempo real da operação**
2. **Redução de risco e custo**
3. **Confiabilidade de execução (mesmo offline)**

---

## Fase 1 — WOW operacional (2 a 4 semanas)

### 1) Torre operacional (painel)
- Mapa com OS em andamento
- Status por motorista (pendente / em andamento / pausada / concluída)
- Alertas em destaque (atraso, desvio, km inconsistente)

### 2) Copiloto do motorista (app)
- Alertas contextuais na OS:
  - fora de rota
  - atraso em início/finalização
  - km divergente
- Mensagens automáticas orientativas por cenário

### 3) Regras de negócio centralizadas
- Não iniciar OS futura
- Não permitir duas OS em andamento
- Bloqueios de abastecimento por permissão
- Obrigatoriedade de evidência (cupom/foto/justificativa)

### Entregável visual para empresas
- Dashboard com semáforo operacional (verde/amarelo/vermelho)
- Timeline de eventos por OS (auditoria legível)

---

## Fase 2 — Plataforma ponta a ponta (4 a 6 semanas)

### 1) Workflow completo de aprovações
- Abastecimento: enviado → visto → aprovado/negado → concluído
- Manutenção: enviado → análise → aprovado/reprovado → concluído
- Registro de quem aprovou, quando e por qual motivo

### 2) Financeiro operacional integrado
- Extras por motorista com status (pendente/pago)
- Custos vinculados à OS e manutenção
- Visão por veículo e por motorista

### 3) Contratos e recorrência (MVP robusto)
- Contratos recorrentes com horários
- Alocação de motorista/veículo por regra
- Geração automática de OS com rastreabilidade

### Entregável visual para empresas
- Tela “Resultado Operacional”:
  - custo por km
  - custo por OS
  - custo por veículo
  - pendências de aprovação

---

## Fase 3 — Confiabilidade nível produção (3 a 5 semanas)

### 1) Offline-first real
- Fila offline com replay automático
- Deduplicação por chave de evento
- Conflito resolvido por versão/tempo

### 2) Observabilidade
- Log estruturado por ação crítica
- Trilha de auditoria para aprovações
- Métricas operacionais:
  - latência de sincronização
  - taxa de falha por ação
  - itens na fila offline

### 3) Segurança e isolamento
- Revisão final de RLS por empresa/papel
- Cobertura dos fluxos críticos em backend (não só no app)
- Hardening de permissões admin/motorista

### Entregável visual para empresas
- “Painel de Confiabilidade” com:
  - disponibilidade
  - sincronizações bem-sucedidas
  - incidentes críticos

---

## Backlog imediato (ordem de execução)

1. Concluir replay automático da offlineQueue
2. Fechar workflow de aprovação (abastecimento/manutenção) fim-a-fim
3. Implementar painel de alertas operacionais (atraso/desvio/km)
4. Fechar dashboard de resultados operacionais (custos e produtividade)
5. Revisão final de RLS + testes E2E críticos

---

## Critérios de “lançamento que enche os olhos”

- Empresa vê operação ao vivo em 1 tela
- Motorista executa tudo no app sem fricção
- Aprovação/admin com auditoria clara
- Sistema continua funcionando mesmo sem internet
- Indicadores de custo/produtividade visíveis no primeiro dia
