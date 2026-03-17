# Plano de Desenvolvimento — App Motorista (15/03/2026)

## Objetivo

Concluir o app do motorista com nível de produção, cobrindo operação em campo, resiliência offline, notificações configuráveis e visibilidade operacional/financeira.

---

## Estado atual (já entregue)

- Login e troca de senha inicial.
- Dashboard com OS e acesso ao detalhe.
- Fluxo operacional da OS no mobile:
  - iniciar/concluir,
  - km inicial/final,
  - evidências (upload),
  - timeline de eventos.
- Presença de passageiros:
  - sincronizar,
  - marcar `PENDENTE / EMBARCOU / FALTOU / EXTRA`.
- Manutenção (solicitação + acompanhamento).
- Abastecimento (solicitar/registrar, com permissão).
- Configurações separadas:
  - Perfil,
  - Arquivos,
  - Aparência,
  - **Notificações** (novo menu e tela de preferências).

---

## Fase 2 — Confiabilidade operacional (prioridade máxima)

### 2.1 Offline-first completo
- Criar fila local para ações críticas:
  - iniciar/concluir OS,
  - presença de passageiros,
  - abastecimento,
  - manutenção.
- Implementar retry automático com backoff ao recuperar internet.
- Garantir idempotência nas ações replayadas.

### 2.2 Geolocalização operacional contínua
- Ping periódico de localização durante OS em execução.
- Regras de envio:
  - foreground (intervalo curto),
  - background (intervalo maior, com economia de bateria).
- Registrar falhas de envio com retry e observabilidade local.

### 2.3 Abastecimento com evidência robusta
- Tornar obrigatório comprovante real para abastecimento externo.
- Upload de cupom/foto com validações mínimas (tipo/tamanho).
- Melhorar mensagens de erro por causa real (rede, storage, regra de negócio).

---

## Fase 3 — Comunicação e produtividade

### 3.1 Notificações push fim-a-fim
- Integrar push (token, registro e entrega).
- Eventos de push:
  - nova OS,
  - alteração de OS,
  - atualização de manutenção,
  - atualização de abastecimento,
  - alertas críticos.

### 3.2 Preferências de notificações (motorista)
- **Requisito do projeto**: manter menu em Configurações > Notificações (já implementado).
- Garantir que preferências sejam respeitadas no dispatch de notificações.
- Criar fallback de notificação in-app quando push indisponível.

### 3.3 Histórico com filtros
- Histórico de OS (incluindo concluídas/canceladas).
- Histórico de abastecimentos e manutenções.
- Filtros por data, status e veículo.

**Status atual:** concluída.

Entregue neste ciclo:
- nova tela `HistoricoScreen` no app motorista;
- agregação de histórico de:
  - OS concluídas/canceladas,
  - abastecimentos concluídos/cancelados,
  - manutenções concluídas/canceladas;
- filtros por tipo (OS/abastecimento/manutenção), status e busca textual;
- integração da aba `Histórico` na navegação principal.

---

## Fase 4 — Transparência e inteligência operacional

### 4.1 Extrato financeiro do motorista
- Mostrar extras pendentes/pagos por competência.
- Detalhar origem dos valores (OS, ajuste, bônus/desconto).

**Status atual:** concluída (MVP funcional).

Entregue neste ciclo:
- nova tela `FinanceiroScreen`;
- leitura de `motorista_extras` por motorista;
- resumo por status (`pendente`, `pago`, `cancelado`);
- filtros por status e competência;
- integração da aba `Financeiro` na navegação principal.

### 4.2 Indicadores pessoais
- Pontualidade,
- conformidade operacional,
- consumo/eficiência.

**Status atual:** concluída (MVP com KPIs operacionais).

Entregue neste ciclo:
- bloco de indicadores no dashboard (30 dias), incluindo:
  - total de OS,
  - concluídas/canceladas,
  - pontualidade (início real com tolerância operacional),
  - conformidade de evidências,
  - adesão de checklist,
  - média de km por OS concluída.

### 4.3 Checklist operacional por tipo de OS
- Pré-partida,
- embarque,
- pós-serviço,
- fechamento de evidências obrigatório por etapa.

**Status atual:** concluída (MVP + hardening de regras).

Entregue neste ciclo:
- migration de base `os_checklist_execucao`;
- checklist em `OsDetailScreen` com 3 etapas (pré-partida/embarque/pós-serviço);
- persistência por item via upsert, com leitura do progresso ao abrir a OS.
- regras de bloqueio no backend para impedir:
  - início da OS sem checklist de pré-partida e evidência de início;
  - conclusão da OS sem checklist completo e evidência final.
- checklist configurável pelo painel web (Configurações > Checklist), com aplicação dinâmica no app motorista e no backend.

---

## Critérios de pronto (DoD)

Cada entrega deve ter:

1. Fluxo funcional no app (Expo Go).
2. Validação de tipos (`tsc --noEmit`).
3. Mensagens de erro tratadas para rede e regra de negócio.
4. Persistência e leitura no Supabase com RLS compatível.
5. Registro mínimo em docs (changelog de sessão).

---

## Ordem prática recomendada (execução)

1. Offline queue (base técnica para tudo).
2. Geo contínuo + replay seguro.
3. Endurecimento do abastecimento com comprovante obrigatório.
4. Push notifications respeitando preferências.
5. Histórico/filtros.
6. Extrato financeiro.
7. Indicadores e checklist avançado.
