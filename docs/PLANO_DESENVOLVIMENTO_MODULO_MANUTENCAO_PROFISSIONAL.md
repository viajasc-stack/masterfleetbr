# 🔧 Plano de Desenvolvimento — Módulo de Manutenção Profissional

> **Objetivo:** Reconstruir o módulo de manutenção do zero, com arquitetura profissional de oficina mecânica, integração total com app motorista, estoque compartilhado com inventário, e fluxo completo de ponta a ponta.

---

## 📋 Princípios de Design

1. **Estoque Único** — Reutilizar `produtos`, `locais_estoque`, `movimentos_estoque` do inventário
2. **Solicitação → OS → Execução → Financeiro** — Fluxo linear e rastreável
3. **App Motorista Integrado** — Solicitação no app aparece instantaneamente no painel
4. **Multiempresa com RLS** — Isolamento total de dados
5. **Offline-First no App** — Motorista pode abrir solicitação sem internet
6. **Auditoria Completa** — Quem fez o que, quando e por quê

---

## 🗄️ Arquitetura do Banco de Dados

### Tabelas Existentes (Reaproveitadas)
| Tabela | Uso |
|--------|-----|
| `veiculos` | Veículos da frota |
| `motoristas` | Motoristas que abrem solicitações |
| `fornecedores` | Oficinas e autopeças |
| `produtos` | Peças e materiais (inventário) |
| `locais_estoque` | Depósitos/almoxarifados |
| `movimentos_estoque` | Baixas e entradas de peças |
| `contas_financeiras` | Contas a pagar geradas pelas OS |

### Tabelas do Módulo de Manutenção (Novo Schema)

#### 1. `manutencao_solicitacoes` (substitui `solicitacoes_manutencao`)
```sql
CREATE TABLE manutencao_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  veiculo_id uuid NOT NULL,
  motorista_id uuid,                    -- quem abriu
  categoria text,                       -- motor, freios, suspensão, elétrica, pneus, outros
  titulo text NOT NULL,                 -- resumo curto
  descricao text NOT NULL,              -- detalhe completo
  prioridade manutencao_prioridade DEFAULT 'media',
  status solicitacao_manutencao_status DEFAULT 'nova',
  origem solicitacao_manutencao_origem DEFAULT 'admin',
  km_atual numeric,                     -- km no momento da solicitação
  fotos text[],                         -- URLs das fotos (Supabase Storage)
  created_by uuid,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 2. `manutencao_ordens` (substitui `ordens_manutencao`)
```sql
CREATE TABLE manutencao_ordens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  solicitacao_id uuid,                  -- origem
  veiculo_id uuid NOT NULL,
  motorista_id uuid,                    -- motorista responsável
  tipo ordem_manutencao_tipo DEFAULT 'corretiva',
  status ordem_manutencao_status DEFAULT 'aberta',
  prioridade manutencao_prioridade DEFAULT 'media',
  
  -- Diagnóstico
  diagnostico text,
  causa_raiz text,                      -- causa do problema
  solucao_aplicada text,                -- o que foi feito
  
  -- Oficina
  oficina_id uuid,                      -- fornecedor (oficina externa)
  oficina_interna boolean DEFAULT true, -- true = oficina própria
  
  -- Dados operacionais
  km_entrada numeric,
  km_saida numeric,
  data_entrada timestamptz,
  data_saida_prevista timestamptz,
  data_saida_real timestamptz,
  
  -- Financeiro
  custo_pecas numeric DEFAULT 0,
  custo_mao_de_obra numeric DEFAULT 0,
  custo_terceiros numeric DEFAULT 0,
  custo_total numeric DEFAULT 0,
  
  -- Controle
  responsavel_tecnico text,             -- nome do mecânico/técnico
  laudo_tecnico text,
  fotos_antes text[],
  fotos_depois text[],
  anexos jsonb,
  
  created_by uuid,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### 3. `manutencao_ordens_pecas` (peças aplicadas)
```sql
CREATE TABLE manutencao_ordens_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem_id uuid NOT NULL,
  produto_id uuid NOT NULL,             -- referencia produtos do inventário
  local_estoque_id uuid,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_unitario numeric NOT NULL,
  origem manutencao_peca_origem DEFAULT 'estoque',
  lote text,                            -- rastreabilidade
  created_at timestamptz DEFAULT now()
);
```

#### 4. `manutencao_ordens_servicos` (serviços/mão de obra)
```sql
CREATE TABLE manutencao_ordens_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem_id uuid NOT NULL,
  tipo_servico_id uuid,
  descricao text,
  quantidade_horas numeric,
  valor_hora numeric,
  valor_total numeric DEFAULT 0,
  mecanico_responsavel text,
  created_at timestamptz DEFAULT now()
);
```

#### 5. `manutencao_checklist` (checklist de entrada/saída)
```sql
CREATE TABLE manutencao_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  ordem_id uuid NOT NULL,
  tipo text NOT NULL,                   -- 'entrada' ou 'saida'
  itens jsonb NOT NULL,                 -- [{item, status, obs}]
  observacoes_gerais text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
```

#### 6. `manutencao_planos_preventivos` (planos de manutenção)
```sql
CREATE TABLE manutencao_planos_preventivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  tipo_veiculo text,
  intervalo_km integer,
  intervalo_dias integer,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

#### 7. `manutencao_planos_itens` (itens do plano)
```sql
CREATE TABLE manutencao_planos_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  plano_id uuid NOT NULL,
  produto_id uuid,                      -- peça a trocar
  tipo_servico_id uuid,                 -- serviço a executar
  quantidade numeric DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
```

#### 8. `manutencao_veiculo_planos` (planos aplicados a veículos)
```sql
CREATE TABLE manutencao_veiculo_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  veiculo_id uuid NOT NULL,
  plano_id uuid NOT NULL,
  ultima_execucao date,
  proxima_execucao_km numeric,
  proxima_execucao_data date,
  status text DEFAULT 'em_dia',         -- em_dia, vencendo, vencido
  created_at timestamptz DEFAULT now(),
  UNIQUE(veiculo_id, plano_id)
);
```

#### 9. `manutencao_historico_veiculo` (view materializada)
```sql
CREATE MATERIALIZED VIEW manutencao_historico_veiculo AS
SELECT 
  v.id as veiculo_id,
  v.placa,
  v.modelo,
  COUNT(o.id) as total_os,
  SUM(o.custo_total) as custo_total,
  MAX(o.data_entrada) as ultima_manutencao,
  -- ... mais métricas
FROM veiculos v
LEFT JOIN manutencao_ordens o ON o.veiculo_id = v.id
GROUP BY v.id, v.placa, v.modelo;
```

#### 10. `manutencao_alertas` (alertas automáticos)
```sql
CREATE TABLE manutencao_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  veiculo_id uuid,
  ordem_id uuid,
  tipo text NOT NULL,                   -- preventiva_vencida, custo_excedido, etc
  severidade text DEFAULT 'media',      -- baixa, media, alta, critica
  titulo text NOT NULL,
  mensagem text,
  lido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

## 📱 Funcionalidades do App Motorista

### Tela de Manutenção no App (Reconstruída)

#### 1. Nova Solicitação
- **Seleção de veículo** (se motorista tem mais de um)
- **Categoria do problema** (dropdown):
  - Motor
  - Freios
  - Suspensão/Direção
  - Elétrica
  - Pneus
  - Carroceria
  - Ar-condicionado
  - Outros
- **Título** (obrigatório, máx 80 chars)
- **Descrição detalhada** (obrigatório, mín 20 chars)
- **Fotos** (até 5 fotos, compressão automática)
- **KM atual** (preenchido automaticamente se disponível)
- **Prioridade percebida** (baixa, média, alta)

#### 2. Minhas Solicitações
- Lista de solicitações abertas com status em tempo real
- Status visuais com cores:
  - 🟢 Aprovada
  - 🟡 Em análise
  - 🔴 Rejeitada
  - 🔵 Em andamento
  - ⚫ Concluída
- Detalhe ao clicar: diagnóstico, previsão de retorno

#### 3. Checklist Pré-Viagem
- Checklist obrigatório antes de iniciar viagem
- Itens com foto obrigatória se problema detectado
- Problemas no checklist geram solicitação automática

---

## 🖥️ Funcionalidades do Painel Web

### Dashboard de Manutenção
| Widget | Descrição |
|--------|-----------|
| OS Abertas | Contagem + link para lista |
| OS em Andamento | Contagem + link |
| Aguardando Peças | Contagem + link |
| Preventivas Vencidas | Contagem + alerta |
| Custo do Mês | Valor total + comparativo com mês anterior |
| Frota Disponível | % de veículos operantes |
| Top 5 Veículos Custo | Ranking com valores |
| OS Urgentes | Lista com link direto |

### Solicitações (Inbox)
- **Fila de entrada** de todas as solicitações
- **Filtros**: status, prioridade, categoria, veículo, período, origem
- **Ações rápidas**:
  - ✅ Aprovar → gera OS automaticamente
  - ❌ Rejeitar (com motivo obrigatório)
  - 📝 Solicitar mais informações
  - 🔧 Converter em OS
- **Notificação em tempo real** quando motorista envia nova solicitação

### Ordens de Serviço (OS)
#### Fluxo Completo
```
1. ABERTA → OS criada, aguardando triagem
2. EM ANÁLISE → Técnico avaliando
3. AGUARDANDO PEÇAS → Peças solicitadas ao estoque/compra
4. EM ANDAMENTO → Execução em curso
5. FINALIZADA → OS concluída, conta a pagar gerada
```

#### Detalhe da OS (Wizard em Abas)
| Aba | Conteúdo |
|-----|----------|
| **Dados Gerais** | Veículo, tipo, prioridade, status, oficina |
| **Checklist Entrada** | Estado do veículo na entrada |
| **Diagnóstico** | Laudo técnico, causa raiz, fotos |
| **Peças** | Lista de peças usadas (busca no inventário) |
| **Serviços** | Mão de obra e serviços aplicados |
| **Checklist Saída** | Estado do veículo na saída |
| **Financeiro** | Resumo de custos, conta a pagar |
| **Anexos** | Fotos, documentos, laudos |
| **Histórico** | Timeline de todas as alterações |

### Preventivas
- **Planos de manutenção** por tipo de veículo
- **Aplicação de planos** a veículos específicos
- **Cálculo automático** de próxima troca (por km ou dias)
- **Geração automática** de OS quando preventiva vence
- **Calendário visual** de preventivas

### Indicadores (KPIs)
| Indicador | Fórmula |
|-----------|---------|
| **MTBF** | Tempo total / Nº de falhas |
| **MTTR** | Tempo total de reparo / Nº de reparos |
| **Disponibilidade** | (Tempo disponível / Tempo total) × 100 |
| **Custo/km** | Custo total manutenção / Km total rodado |
| **Custo/veículo/mês** | Custo total / Nº veículos |
| **Backlog** | OS pendentes / Capacidade mensal |
| **Taxa de repetição** | OS repetidas / Total OS |

### Relatórios
- Custo de manutenção por veículo/período
- Peças mais utilizadas
- Veículos com maior custo
- Tempo médio de reparo por tipo
- Custo por categoria (motor, freios, etc.)
- Exportação PDF/Excel

---

## 🔄 Integrações

### 1. App → Painel (Solicitação em Tempo Real)
```
Motorista abre solicitação no app
  → Supabase insert em `manutencao_solicitacoes`
    → Realtime subscription no painel
      → Notificação aparece instantaneamente
        → Badge no menu "Manutenção"
```

### 2. Estoque Compartilhado
```
OS precisa de peça
  → Busca em `produtos` (inventário)
    → Reserva em `manutencao_reservas`
      → Ao aplicar: gera `movimentos_estoque` (saida)
        → Atualiza saldo automaticamente
```

### 3. Financeiro Automático
```
OS finalizada com custo > 0
  → Gera `contas_financeiras` automaticamente
    → Categoria: "Manutenção"
      → Status: pendente
        → Aparece no financeiro do painel
```

### 4. Push Notifications
```
OS muda de status
  → Edge Function `push-dispatch`
    → Envia para tokens do motorista
      → Notificação no celular
```

---

## 📅 Plano de Desenvolvimento por Fases

### FASE 1 — Fundação (Semana 1-2)
**Objetivo:** Banco de dados novo + tela básica de solicitações

#### Tarefas
- [ ] **1.1** Criar migration com novo schema completo
- [ ] **1.2** Criar RPCs básicos:
  - `manutencao_criar_solicitacao`
  - `manutencao_aprovar_solicitacao`
  - `manutencao_rejeitar_solicitacao`
  - `manutencao_converter_em_os`
- [ ] **1.3** Atualizar tela de manutenção no app motorista
  - Formulário de nova solicitação com categorias
  - Upload de fotos (Supabase Storage)
  - Lista de solicitações com status
  - Realtime subscription
- [ ] **1.4** Criar tela de solicitações no painel web
  - Inbox com filtros
  - Ações rápidas (aprovar/rejeitar/convertar)
  - Notificação realtime

#### Critérios de Aceite
- [ ] Motorista consegue abrir solicitação com foto
- [ ] Solicitação aparece no painel em < 2 segundos
- [ ] Admin consegue aprovar e gerar OS
- [ ] RLS funcionando (empresa só vê seus dados)

---

### FASE 2 — Ordens de Serviço (Semana 3-4)
**Objetivo:** CRUD completo de OS com peças e serviços

#### Tarefas
- [ ] **2.1** Dashboard de manutenção com KPIs
- [ ] **2.2** Tela de ordens de serviço
  - Listagem com filtros avançados
  - Paginação
  - Status visual
- [ ] **2.3** Detalhe da OS (wizard em abas)
  - Dados gerais
  - Diagnóstico
  - Peças (integração com inventário)
  - Serviços
  - Financeiro
- [ ] **2.4** RPCs:
  - `manutencao_adicionar_peca` (com baixa no estoque)
  - `manutencao_adicionar_servico`
  - `manutencao_recalcular_custo`
  - `manutencao_finalizar_ordem` (gera conta a pagar)
- [ ] **2.5** Checklist de entrada/saída

#### Critérios de Aceite
- [ ] OS pode ser criada a partir de solicitação ou do zero
- [ ] Peças dão baixa no inventário automaticamente
- [ ] Custo total é calculado automaticamente
- [ ] Finalizar OS gera conta a pagar

---

### FASE 3 — Preventivas (Semana 5-6)
**Objetivo:** Planos preventivos com geração automática

#### Tarefas
- [ ] **3.1** CRUD de planos de manutenção
- [ ] **3.2** Aplicação de planos a veículos
- [ ] **3.3** Cálculo automático de próxima execução
- [ ] **3.4** Job/pg_cron para gerar OS de preventivas vencidas
- [ ] **3.5** Calendário visual de preventivas
- [ ] **3.6** Alertas de preventiva vencendo

#### Critérios de Aceite
- [ ] Plano pode ser criado por tipo de veículo
- [ ] Preventiva gera OS automaticamente quando vence
- [ ] Alertas aparecem no dashboard

---

### FASE 4 — Indicadores e Relatórios (Semana 7-8)
**Objetivo:** Inteligência de manutenção

#### Tarefas
- [ ] **4.1** RPCs de indicadores:
  - `manutencao_kpis`
  - `manutencao_custo_por_veiculo`
  - `manutencao_mtbf_mttr`
  - `manutencao_disponibilidade_frota`
- [ ] **4.2** Dashboard de indicadores com gráficos
- [ ] **4.3** Relatórios exportáveis (PDF/Excel)
- [ ] **4.4** Ranking de veículos por custo
- [ ] **4.5** Análise de peças mais utilizadas

#### Critérios de Aceite
- [ ] KPIs calculados corretamente
- [ ] Gráficos renderizados
- [ ] Exportação funcionando

---

### FASE 5 — Automações e Alertas (Semana 9-10)
**Objetivo:** Sistema inteligente de alertas

#### Tarefas
- [ ] **5.1** Tabela de alertas
- [ ] **5.2** RPC de geração de alertas:
  - Preventiva vencida
  - Custo excedido
  - Veículo parado há muitos dias
  - Peça com estoque baixo
- [ ] **5.3** Push notifications para alertas
- [ ] **5.4** WhatsApp para alertas críticos
- [ ] **5.5** Orçamento de manutenção por veículo

#### Critérios de Aceite
- [ ] Alertas gerados automaticamente
- [ ] Notificações chegam no app
- [ ] WhatsApp dispara para críticos

---

### FASE 6 — Polimento e Go-Live (Semana 11-12)
**Objetivo:** UX, testes e deploy

#### Tarefas
- [ ] **6.1** Toast notifications em todas as ações
- [ ] **6.2** Validações de formulário
- [ ] **6.3** Tratamento de erros
- [ ] **6.4** Testes E2E dos fluxos críticos
- [ ] **6.5** Migração de dados antigos
- [ ] **6.6** Documentação
- [ ] **6.7** Deploy em produção

#### Critérios de Aceite
- [ ] Zero erros críticos
- [ ] UX fluida e responsiva
- [ ] Dados antigos migrados

---

## 🔌 Endpoints e RPCs Necessários

### RPCs do Supabase
| Nome | Parâmetros | Retorno | Descrição |
|------|-----------|---------|-----------|
| `manutencao_criar_solicitacao` | veiculo_id, categoria, titulo, descricao, prioridade, km_atual, fotos | id | Cria nova solicitação |
| `manutencao_aprovar_solicitacao` | solicitacao_id | id | Aprova e gera OS |
| `manutencao_rejeitar_solicitacao` | solicitacao_id, motivo | void | Rejeita solicitação |
| `manutencao_converter_em_os` | solicitacao_id | ordem_id | Converte em OS |
| `manutencao_adicionar_peca` | ordem_id, produto_id, quantidade, local_id | id | Adiciona peça e dá baixa |
| `manutencao_adicionar_servico` | ordem_id, tipo_servico_id, descricao, valor | id | Adiciona serviço |
| `manutencao_finalizar_ordem` | ordem_id, gerar_conta_pagar | void | Finaliza OS e gera conta |
| `manutencao_kpis` | data_inicio, data_fim | json | Retorna KPIs do período |
| `manutencao_gerar_alertas` | empresa_id | count | Gera alertas pendentes |
| `manutencao_processar_preventivas` | void | count | Gera OS de preventivas vencidas |

### Realtime Subscriptions
| Canal | Evento | Ação |
|-------|--------|------|
| `manutencao_solicitacoes:empresa_id=eq:*` | INSERT | Notificar nova solicitação |
| `manutencao_ordens:id=eq:*` | UPDATE | Atualizar status na tela |
| `manutencao_alertas:empresa_id=eq:*` | INSERT | Mostrar alerta |

---

## 📦 Componentes React Necessários

### Web (Painel)
| Componente | Descrição |
|-----------|-----------|
| `ManutencaoDashboard` | Dashboard com KPIs |
| `SolicitacoesInbox` | Fila de solicitações |
| `OrdensList` | Lista de OS com filtros |
| `OrdemWizard` | Wizard de detalhe da OS |
| `ChecklistForm` | Formulário de checklist |
| `PreventivasCalendar` | Calendário de preventivas |
| `IndicadoresPanel` | Gráficos de KPIs |
| `AlertasList` | Lista de alertas |
| `PecaSelector` | Busca de peças no inventário |
| `StatusBadge` | Badge de status colorido |
| `VeiculoCard` | Card de veículo com info |

### Mobile (App Motorista)
| Componente | Descrição |
|-----------|-----------|
| `ManutencaoScreen` | Tela principal |
| `NovaSolicitacaoForm` | Formulário de solicitação |
| `FotoUploader` | Upload com compressão |
| `SolicitacoesList` | Lista de solicitações |
| `StatusTimeline` | Timeline de status |

---

## 🎨 Design System

### Cores de Status
| Status | Cor | Uso |
|--------|-----|-----|
| Nova | 🔵 Blue | Solicitação recém-criada |
| Em análise | 🟡 Amber | Sendo avaliada |
| Aprovada | 🟢 Green | Aprovada para execução |
| Rejeitada | 🔴 Red | Rejeitada |
| Em andamento | 🔵 Blue | OS em execução |
| Aguardando peças | 🟠 Orange | Dependendo de peças |
| Finalizada | 🟢 Green | Concluída |
| Cancelada | ⚫ Gray | Cancelada |

---

## ✅ Checklist de Go-Live

### Banco de Dados
- [ ] Migration executada em produção
- [ ] RLS policies testadas
- [ ] Índices criados
- [ ] Triggers funcionando
- [ ] RPCs testados

### Frontend Web
- [ ] Todas as telas implementadas
- [ ] Responsividade testada
- [ ] Realtime funcionando
- [ ] Paginação funcionando
- [ ] Exportação de relatórios

### App Motorista
- [ ] Tela de manutenção atualizada
- [ ] Upload de fotos funcionando
- [ ] Offline queue funcionando
- [ ] Push notifications funcionando
- [ ] Realtime funcionando

### Integrações
- [ ] Estoque compartilhado testado
- [ ] Financeiro automático testado
- [ ] Push notifications testados
- [ ] WhatsApp (se aplicável)

### Qualidade
- [ ] Testes E2E passando
- [ ] Lint sem erros
- [ ] Build sem warnings
- [ ] Performance aceitável

---

## 📊 Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Tempo de criação de solicitação | < 30 segundos |
| Tempo de aparição no painel | < 2 segundos |
| Tempo de geração de OS | < 1 segundo |
| Disponibilidade do módulo | > 99.5% |
| Satisfação do usuário | > 4/5 |

---

## 🚀 Próximos Passos

1. **Aprovar este plano** com o stakeholder
2. **Iniciar Fase 1** — Fundação do banco de dados
3. **Criar branch** `feature/manutencao-profissional`
4. **Executar migration** em ambiente de homologação
5. **Desenvolver iterativamente** com demos semanais