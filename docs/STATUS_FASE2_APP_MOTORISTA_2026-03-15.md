# Status Fase 2 — App Motorista (15/03/2026)

## Entregas concluídas nesta sessão

### 1) Base offline-first (fila local + replay)
- Criado `src/lib/offlineQueue.ts` com:
  - persistência da fila em `AsyncStorage`;
  - `enqueueOfflineAction`;
  - `processOfflineQueue` com tentativa de replay quando online;
  - detecção simples de erro de rede (`isLikelyNetworkError`);
  - suporte para ações:
    - `os_update_status`
    - `os_sync_passageiros`
    - `os_update_presenca`
    - `os_location_ping`
    - `abastecimento_insert`
    - `manutencao_solicitar`

### 2) Integração da fila nas ações críticas

#### OS (detalhe)
- Arquivo: `src/screens/OsDetailScreen.tsx`
- Quando há falha de rede:
  - atualizar status da OS entra na fila;
  - sincronizar passageiros entra na fila;
  - atualizar presença entra na fila.

#### Abastecimento
- Arquivo: `src/screens/AbastecimentoScreen.tsx`
- Quando há falha de rede:
  - solicitação entra na fila;
  - registro (interno/externo) entra na fila.

#### Manutenção
- Arquivo: `src/screens/ManutencaoScreen.tsx`
- Quando há falha de rede:
  - chamada `rpc_manutencao_solicitar` entra na fila.

### 3) Geo operacional contínua (base)
- Criado `src/lib/location.ts` com coleta de coordenadas via geolocation.
- Em `OsDetailScreen.tsx`:
  - quando OS está em execução, envia ping de localização para `os_eventos` em intervalo;
  - se offline, enfileira `os_location_ping`.

### 4) Abastecimento com comprovante obrigatório (posto)
- Arquivo: `src/screens/AbastecimentoScreen.tsx`
- Registro externo exige comprovante anexado antes de salvar.
- Implementado upload de comprovante e uso da URL real em `cupom_url`.

### 5) Indicador de pendências offline no app
- Arquivo: `src/AppRoot.tsx`
- Integração com `processOfflineQueue` periódica e contador de pendências no header.

---

## Observações técnicas

- O replay atual foca erros de rede para reter ação em fila.
- Erros de regra de negócio não entram em retry infinito.
- Upload de cupom foi conectado ao bucket `odometro` como base imediata.

---

## Próximos ajustes recomendados (Fase 2.1+)

1. Implementar backoff progressivo por item da fila (hoje é retry simples por ciclo).
2. Incluir idempotency key por ação crítica no payload (evitar duplicidade em cenários extremos).
3. Migrar comprovantes de abastecimento para bucket dedicado (ex.: `abastecimentos`) com políticas próprias.
4. Trocar geolocation web API por stack nativa Expo Location + background task (produção Android/iOS).

---

## Incremento adicional (mesma fase) — Robustez da fila offline

- Adicionado backoff progressivo por item (`nextAttemptAt`) na fila.
- Adicionado dedupe/idempotência por `idempotencyKey` no enfileiramento.
- Propagada idempotency key nas ações críticas de:
  - OS (status, sync passageiros, presença, location ping),
  - abastecimento (solicitação/registro),
  - manutenção.
- Adicionadas métricas simples da fila (`processed`, `failedNetwork`, `failedBusiness`, `dropped`, `pending`).
- Header do app passa a mostrar meta resumida da última sincronização offline.

---

## Incremento adicional (Fase 2.2) — Geolocalização de produção

- Adicionadas dependências `expo-location` e `expo-task-manager`.
- `src/lib/location.ts` evoluído para:
  - solicitar permissões foreground/background;
  - iniciar/parar tracking operacional;
  - definir task em background para coleta contínua;
  - enviar pings para `os_eventos` e, em falha de rede, enfileirar `os_location_ping` na fila offline.
- `src/screens/OsDetailScreen.tsx` integrado para:
  - iniciar tracking quando OS entra em execução;
  - parar tracking quando OS sai de execução/tela desmonta.
- `app.json` atualizado com permissões/configuração iOS + Android para location foreground/background.

---

## Incremento adicional (Fase 2.3) — Hardening de comprovantes de abastecimento

- Criada migration `20260315051500_create_storage_abastecimentos_bucket.sql` com bucket dedicado `abastecimentos`.
- Aplicadas políticas de storage para `SELECT/INSERT/UPDATE/DELETE` com escopo por empresa (`public.minha_empresa_id()`).
- `AbastecimentoScreen.tsx` atualizado para:
  - usar bucket `abastecimentos` (não mais `odometro`) para cupom;
  - validar tipo permitido (`JPG`, `PNG`, `PDF`);
  - validar limite de tamanho (10MB) antes de upload.

---

## Incremento adicional (Fase 3.1 parcial) — Base de push + fallback Expo Go

- Dependências adicionadas no app motorista:
  - `expo-notifications`
  - `expo-device`
  - `expo-constants`
- `app.json` atualizado com plugin `expo-notifications`.
- Criada migration `20260315053000_create_motorista_push_tokens.sql` com:
  - tabela `motorista_push_tokens`;
  - índices;
  - RLS/policies por empresa;
  - trigger para `empresa_id`/`updated_at`.
- Criado `src/lib/push.ts` para registro de token Expo push por motorista.
- Hardening de runtime no `push.ts`:
  - fallback seguro para **Expo Go** (`Constants.appOwnership === 'expo'`),
  - tratamento defensivo para não quebrar o app quando push remoto não estiver disponível.
- Criado `src/lib/inAppNotifications.ts` como fallback in-app:
  - leitura de notificações não lidas da tabela `notifications`;
  - respeito às preferências em `motorista_notificacao_preferencias`;
  - prioridade para críticas (`nivel = 'critical'`).
- `src/AppRoot.tsx` atualizado para:
  - registrar token push quando disponível;
  - mostrar resumo de notificações pendentes (contador + último título) no header.

---

## Incremento adicional (Fase 3.1) — Push fim-a-fim (dispatch backend + gatilho por evento)

- Criada migration `20260315060000_push_dispatch_notifications.sql` com:
  - tabela `motorista_push_outbox` para fila de envio de push por motorista;
  - índices de fila (`status/next_retry_at`) e rastreabilidade por empresa/notificação;
  - RLS/policies por empresa;
  - trigger de `updated_at`/`empresa_id` para consistência;
  - função `should_send_motorista_notification(...)` para aplicar preferências do motorista;
  - função/trigger `enqueue_motorista_push_from_notification` em `notifications` para enfileirar push automaticamente ao criar notificação.

- Criada edge function `supabase/functions/push-dispatch/index.ts` com:
  - processamento em lote da outbox (`motorista_push_outbox`);
  - lock otimista (`queued -> sending`) para evitar dupla execução concorrente;
  - envio ao endpoint Expo Push (`https://exp.host/--/api/v2/push/send`);
  - retry com backoff exponencial e limite por item (`max_attempts`);
  - desativação automática de token inválido (`DeviceNotRegistered`) em `motorista_push_tokens`;
  - retorno com métricas de execução (`processed/sent/failed/tokens_deactivated`).

- Hardening operacional no dispatcher push:
  - validação opcional de autorização por secret (`PUSH_DISPATCH_SECRET` via Bearer);
  - saneamento de token push inválido (não-Expo) com desativação preventiva.

- Adicionado scheduler GitHub Actions:
  - `.github/workflows/schedule-push-dispatch.yml`;
  - execução manual e agendada a cada 5 minutos;
  - fallback de auth:
    - usa `PUSH_DISPATCH_SECRET` quando disponível,
    - caso contrário usa `SUPABASE_SERVICE_ROLE_KEY`.

### Como operar (nesta fase)

- O enfileiramento ocorre automaticamente no `INSERT` em `public.notifications`.
- O envio efetivo ocorre ao invocar a função `push-dispatch` (manual, scheduler externo ou cron do projeto).

---

## Incremento adicional (Fase 3.1+) — Eventos de OS conectados ao push

- Criada migration `20260315070000_notifications_os_events_for_motorista_push.sql` com:
  - trigger `AFTER INSERT` em `ordens_servico` para gerar notificação interna de **nova OS** (`meta.tipo = 'nova_os'`);
  - trigger `AFTER UPDATE OF status` em `ordens_servico` para gerar notificação interna de **alteração de OS** (`meta.tipo = 'alteracao_os'`), com `status_from/status_to` no `meta`.
- Como o pipeline de push já está ligado em `notifications`, esses eventos passam a seguir automaticamente o fluxo:
  - `ordens_servico` -> `notifications` -> `motorista_push_outbox` -> `push-dispatch`.

---

## Incremento adicional (Fase 3.2) — Refino da tela de Notificações

- `src/screens/NotificacoesScreen.tsx` atualizado com:
  - busca local no feed pendente (`TextInput`);
  - filtro por título, mensagem, tipo, status e número da OS;
  - exibição de metadados úteis no card (`tipo` e `OS`).

---

## Entregáveis de operação/documentação para produção

- Novo checklist operacional: `docs/PUSH_FIM_A_FIM_CHECKLIST_DEPLOY.md`
  - ordem de deploy (migrations + edge function);
  - secrets necessários (Supabase e GitHub);
  - roteiro de teste fim-a-fim;
  - validações pós-deploy.
- Novo plano de commits em blocos lógicos:
  - `docs/COMMIT_PLAN_FASE3_PUSH_NOTIFICACOES.md`.

---

## Incremento adicional (Fase 3.3) — Histórico operacional no app

- Criada tela `src/screens/HistoricoScreen.tsx` com agregação de histórico de:
  - OS concluídas/canceladas;
  - abastecimentos concluídos/cancelados;
  - manutenções concluídas/canceladas.
- Adicionados filtros locais por:
  - tipo (`todos`, `os`, `abastecimento`, `manutencao`),
  - status (texto),
  - busca textual (título/subtítulo/status).
- Integrada nova aba `Histórico` na navegação principal (`AppRoot.tsx`).

---

## Incremento adicional (Fase 4.1) — Extrato financeiro do motorista (base)

- Criada tela `src/screens/FinanceiroScreen.tsx` com leitura de `public.motorista_extras`.
- Funcionalidades entregues:
  - resumo por status (`pendente`, `pago`, `cancelado`),
  - listagem de lançamentos por motorista,
  - filtros por status e competência.
- Integrada nova aba `Financeiro` na navegação principal (`AppRoot.tsx`).
- `src/types.ts` atualizado com novas tabs (`historico`, `financeiro`).

---

## Incremento adicional (Fase 4.2) — Indicadores pessoais (base)

- `src/screens/DashboardScreen.tsx` ampliado com bloco de indicadores (janela de 30 dias):
  - total de OS no período,
  - OS concluídas e canceladas,
  - pontualidade (%),
  - conformidade de evidências (% com início/fim anexados),
  - média de KM por OS concluída.
- Indicadores carregados junto ao refresh do dashboard para manter visão operacional em tempo real.

---

## Incremento adicional (Fase 4.3) — Checklist operacional por OS (base)

- Criada migration `20260315080000_create_os_checklist_execucao.sql` com:
  - tabela `os_checklist_execucao`,
  - RLS/policies por empresa,
  - trigger para `empresa_id` e `updated_at`,
  - unicidade por OS/etapa/item.
- `src/screens/OsDetailScreen.tsx` atualizado com checklist operacional em 3 etapas:
  - pré-partida,
  - embarque,
  - pós-serviço.
- Implementado toggle com persistência via `upsert` em `os_checklist_execucao`.

---

## Incremento adicional (Configuração via painel web) — Checklist dinâmico por empresa

- Criada migration `20260315090000_create_motorista_checklist_config.sql` com:
  - tabela `motorista_checklist_config` por empresa;
  - RLS/policies por empresa;
  - seeds padrão para empresas atuais e novas.
- Painel web:
  - novo submenu **Configurações > Checklist** (`/configuracoes/checklist`);
  - listagem dos itens de checklist com switch de ativar/desativar;
  - salvamento por `upsert` em `motorista_checklist_config`.
- App motorista:
  - `OsDetailScreen` passa a carregar checklist ativo da empresa;
  - exige somente itens ativos para liberar início/conclusão da OS.
- Backend (trigger de fechamento OS):
  - valida checklist obrigatório usando os itens ativos da empresa;
  - mantém fallback para padrão caso configuração ainda não exista.
