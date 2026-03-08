# MasterFleetBR — Checklist Geral (Implementado x Pendências)

> Documento para impressão e acompanhamento manual.
> 
> Legenda:
> - `[x]` Implementado / operacional
> - `[ ]` Pendente / melhoria futura

---

## 1) Base de produto e arquitetura

- [x] Multiempresa com isolamento por RLS
- [x] Autenticação e perfis
- [x] Painel da empresa (web)
- [x] Painel master (admin)
- [x] App motorista (mobile)
- [x] Controle de módulos por plano
- [x] Trial com acesso total aos módulos
- [x] Bloqueio de rotas por módulo não contratado
- [ ] Suite de testes E2E completa dos fluxos críticos
- [ ] Observabilidade central (dash de erros, latência, eventos)

---

## 2) Operação da empresa (painel)

### 2.1 OS / atendimento operacional
- [x] Ordens de serviço (criação e gestão)
- [x] Orçamentos
- [x] Contratos
- [x] Agenda
- [x] Regras de eventos e trilha operacional

### 2.2 Cadastros
- [x] Clientes
- [x] Veículos
- [x] Motoristas
- [x] Usuários

### 2.3 Inventário e suprimentos
- [x] Produtos
- [x] Fornecedores
- [x] Entradas
- [x] Depósitos
- [x] Movimentos

### 2.4 Financeiro
- [x] Contas a pagar/receber
- [x] Fluxo financeiro base
- [x] Assinatura e faturas no painel
- [ ] Automações financeiras avançadas (regras custom por empresa)

### 2.5 Manutenção e relatórios
- [x] Módulo de manutenção
- [x] Módulo de relatórios
- [ ] Relatórios executivos consolidados (board-level)

### 2.6 Suporte (empresa)
- [x] Abertura de ticket
- [x] Conversa por ticket
- [x] Restrição: ticket fechado não recebe nova resposta
- [x] Indicador de não lidas (bolinha vermelha no menu)
- [x] Marcação de leitura por ticket

---

## 3) Painel master (admin)

- [x] Dashboard master
- [x] Gestão de empresas
- [x] Gestão de planos
- [x] Gestão financeira master
- [x] Operações master
- [x] Segurança master
- [x] Configurações master
- [x] Suporte master (fila + detalhe + resposta + status/prioridade)
- [x] Indicador de não lidas no suporte master
- [ ] CRUD visual completo para conteúdo dinâmico da landing (sem SQL)

---

## 4) App motorista

- [x] Login e contexto do motorista
- [x] Fluxo de OS no app
- [x] Pilares de segurança (PIN/biometria)
- [x] Fila offline e replay base
- [x] Envio de geo/ping para regras operacionais
- [ ] Replay offline avançado com governança de conflitos em produção
- [ ] Métricas de sincronização e telemetria operacional no app

---

## 5) Billing / SaaS / pagamentos

- [x] Estrutura de assinaturas e faturas
- [x] Trial automático para novas empresas
- [x] Troca de plano
- [x] Preparação multi-gateway (campos provider em faturas/webhook)
- [x] Integração Mercado Pago (PIX e webhook)
- [ ] Integração ativa com segundo gateway (ex.: Asaas/Stripe)
- [ ] Regras de dunning/retenção (cobrança recorrente avançada)

---

## 6) Landing / comercial

- [x] Página inicial melhorada para venda
- [x] Conteúdo da landing em tabela dinâmica (`site_landing_content`)
- [x] Leitura pública do conteúdo com fallback seguro
- [ ] Editor no painel master para alterar landing sem SQL
- [ ] Conectar planos da landing diretamente da tabela oficial de planos

---

## 7) Itens estratégicos solicitados

### 7.1 Integração com WhatsApp
- [ ] Disparo automático de notificações de OS (início, atraso, conclusão)
- [ ] Disparo de alertas críticos (desvio de rota, exceções)
- [ ] Disparo de notificações de suporte (nova resposta)
- [ ] Templates por empresa (personalização de mensagem)
- [ ] Log/auditoria de mensagens enviadas e falhas

### 7.2 URL personalizada no plano Supremo
- [ ] Modelagem de domínio/subdomínio por empresa (ex.: `empresa.masterfleetbr.com`)
- [ ] Regra de liberação somente para plano Supremo
- [ ] Tela no painel para configurar URL personalizada
- [ ] Validação de disponibilidade de subdomínio
- [ ] Provisionamento DNS + SSL (automático)
- [ ] Middleware/roteamento para servir tenant por domínio

---

## 8) Segurança, qualidade e governança

- [x] Uso extensivo de RLS em dados críticos
- [x] Funções SQL/RPC para regras sensíveis
- [ ] Rotina formal de revisão de políticas RLS por release
- [ ] Cobertura de testes automatizados (unit + integração)
- [ ] CI com gates de qualidade (lint + testes + migrações)
- [ ] Runbooks operacionais e playbooks de incidente

---

## 9) Prioridades sugeridas (ordem prática)

1. [ ] **WhatsApp** (notificações operacionais + suporte)
2. [ ] **URL personalizada Plano Supremo** (diferencial comercial forte)
3. [ ] **Editor da landing no painel master**
4. [ ] **Conectar planos da landing direto do banco de planos**
5. [ ] **Testes/observabilidade para estabilização de escala**

---

## 10) Observações para acompanhamento

- Data da revisão: ____/____/______
- Responsável: ______________________________
- Próxima revisão: ____/____/______

---

## 11) Análise das sugestões de IA — Centro de Inteligência Operacional (CIO)

### 11.1 O que já existe hoje (base pronta)

- [x] Base operacional rica em dados (OS, agenda, manutenção, financeiro, inventário, suporte)
- [x] Eventos operacionais e trilha de auditoria
- [x] Geolocalização e detecção de desvio de rota (base para alertas inteligentes)
- [x] Dashboard/painel para visualização de indicadores
- [x] App motorista com eventos e dados comportamentais iniciais

### 11.2 O que existe parcialmente (precisa evoluir)

- [ ] Alertas preditivos de risco (hoje há base de evento; falta camada de inteligência e priorização)
- [ ] Indicadores de custo por km e anomalias (há dados; falta engine analítica consolidada)
- [ ] Ranking operacional (veículos, motoristas, clientes) com score e critérios padronizados
- [ ] Resumo mensal automático com narrativa executiva
- [ ] Painel único “riscos, atenção, oportunidades”

### 11.3 O que é novo (alto diferencial)

- [ ] Simulador de lucro de contrato (composição de custo + margem estimada)
- [ ] Detector de desperdício (ociosidade, rotas vazias, ativos subutilizados)
- [ ] Previsão de compra de peças (consumo + km + histórico)
- [ ] Previsão de fluxo de caixa 30/60/90 dias
- [ ] Roteirização inteligente de viagens/passageiros (diferencial premium)

---

## 12) Plano de desenvolvimento CIO (fases)

### Fase A — Fundação de Inteligência (rápida, alto impacto)

- [ ] Criar módulo **Centro de Inteligência** no painel da empresa
- [ ] Criar tabela de alertas operacionais (`io_alertas`) com severidade, tipo, recomendação, status
- [ ] Jobs/RPCs para geração automática de alertas (manutenção atrasada, documento vencendo, desvio recorrente)
- [ ] Card-resumo diário: “riscos críticos / atenções / oportunidades”

### Fase B — Scores e Rankings (valor de gestão)

- [ ] Score de motorista (pontualidade + eventos + consumo)
- [ ] Score de veículo (custo + manutenção + disponibilidade)
- [ ] Ranking de veículos problemáticos
- [ ] Ranking de motoristas
- [ ] Ranking de clientes mais lucrativos
- [ ] Score operacional geral da empresa (0–100)

### Fase C — Simulações e previsões (diferencial comercial)

- [ ] Simulador de lucro de contrato (origem/destino/frequência/passageiros)
- [ ] Previsão de fluxo de caixa projetado
- [ ] Detector de desperdício com custo estimado da ociosidade
- [ ] Previsão de reposição de peças/itens críticos

### Fase D — Inteligência avançada (premium)

- [ ] Roteirização inteligente (otimização de trajetos e alocação)
- [ ] Recomendações automáticas de replanejamento de frota
- [ ] Integração com WhatsApp para alertas prioritários do CIO
- [ ] Relatórios executivos automáticos mensais com insights

---

## 13) Mapeamento técnico sugerido (como implementar)

### Banco de dados
- [ ] `io_alertas` (empresa_id, categoria, severidade, titulo, detalhe, recomendacao, origem_ref, status, created_at)
- [ ] `io_scores_diarios` (empresa_id, data, score_geral, score_motoristas, score_veiculos, score_custos)
- [ ] `io_rankings_snapshot` (empresa_id, data, tipo, entidade_id, score, metrica_json)
- [ ] `io_simulacoes_contrato` (empresa_id, parâmetros, resultado_json, created_by)

### Backend / regras
- [ ] RPC `io_generate_alerts(p_empresa_id)`
- [ ] RPC `io_get_dashboard(p_empresa_id)`
- [ ] RPC `io_simular_contrato(...)`
- [ ] Scheduler diário para recalcular scores/rankings

### Frontend
- [ ] Página `/inteligencia` (empresa): visão executiva + cards + filtros
- [ ] Widget de “alertas críticos” no dashboard principal
- [ ] Tela de simulador comercial (novo contrato)
- [ ] Tela de rankings e comparativos mensais

---

## 14) Prioridade revisada (com CIO)

1. [ ] **WhatsApp** (notificações OS + suporte + alertas críticos)
2. [ ] **CIO Fase A** (alertas e painel de risco/oportunidade)
3. [ ] **URL personalizada plano Supremo**
4. [ ] **CIO Fase B** (scores e rankings)
5. [ ] **Editor landing + planos dinâmicos na home**
6. [ ] **CIO Fase C** (simulador de lucro + previsões)
7. [ ] **Roteirização inteligente (Fase D / premium)**
