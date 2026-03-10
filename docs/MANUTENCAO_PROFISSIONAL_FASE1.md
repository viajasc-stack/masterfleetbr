# Manutenção Profissional — Fase 1 (MasterFleetBR)

Esta fase entrega a base da manutenção corretiva com fluxo profissional:

1. Solicitação
2. Triagem
3. Diagnóstico
4. Aprovação
5. Suprimentos/peças
6. Execução
7. Encerramento

## Entregas implementadas

### Banco de dados (migration)

Arquivo: `supabase/migrations/20260310184000_manutencao_profissional_fase1.sql`

- Evolução da tabela `manutencoes` com campos de:
  - origem/solicitante
  - criticidade (urgência / pode_rodar)
  - triagem e diagnóstico
  - aprovação
  - execução
  - custos detalhados
  - recomendação final
- Novo fluxo de status expandido (triagem → diagnóstico → suprimentos → execução → encerramento).
- Numeração por empresa (`manutencao_counters`, `proximo_numero_manutencao`).
- Timeline/histórico (`manutencao_historico`) automática em abertura e mudança de status.
- Itens de manutenção (`manutencao_itens`) com controle de reservado x aplicado.
- Sincronização automática do estado operacional do veículo (`veiculos.estado_operacional`).

### RPCs criadas

- `rpc_manutencao_solicitar`
- `rpc_manutencao_atualizar_status`
- `rpc_manutencao_concluir`
- `rpc_manutencao_reservar_item`
- `rpc_manutencao_cancelar_reserva_item`
- `rpc_manutencao_aplicar_item`

### App motorista

Arquivo: `masterfleetbr-motorista/src/screens/ManutencaoScreen.js`

- Envio prioriza RPC `rpc_manutencao_solicitar`.
- Fallback 1: insert direto na tabela `manutencoes`.
- Fallback 2: notificação administrativa em `notifications`.

### Navegação organizada no painel (submenus)

- Sidebar de **Manutenção** agora possui submenu dedicado:
  - Painel
  - Nova solicitação
  - Estoque da manutenção
  - Reservas de peças
  - Consumo/baixas
- Estrutura conecta Manutenção com Inventário sem duplicar lógica de estoque.

### Telas iniciais de estoque da manutenção

- `src/app/(painel)/manutencao/estoque/page.tsx`
  - visão geral da integração manutenção + inventário
  - KPIs de reservas, itens aplicados e pendências de peça
  - movimentos recentes vinculados à manutenção
- `src/app/(painel)/manutencao/estoque/reservas/page.tsx`
  - lista de reservas abertas por manutenção
- `src/app/(painel)/manutencao/estoque/consumo/page.tsx`
  - baixas definitivas de estoque (consumo) com custo agregado

### Evolução do detalhe da manutenção (continuidade)

- `src/app/(painel)/manutencao/[id]/page.tsx`
  - ações de fluxo por status
  - bloco de triagem/diagnóstico
  - bloco de aprovação
  - ações de estoque por manutenção (reservar, aplicar, cancelar)
- `src/app/(painel)/manutencao/page.tsx`
  - listagem adaptada ao fluxo profissional (status expandidos)
  - acesso direto ao submenu de estoque da manutenção

## Como aplicar

1. Rodar migrations no Supabase (CLI/pipeline já usado no projeto).
2. Publicar app/painel com esta versão.
3. Validar fluxo:
   - abrir solicitação no app motorista
   - confirmar criação em `manutencoes`
   - validar `manutencao_historico`
   - validar atualização de `veiculos.estado_operacional`

## Fechamento do módulo (entrega final)

Arquivo: `supabase/migrations/20260310193000_manutencao_fechamento_modulo.sql`

### Compras da manutenção

- Nova tabela `manutencao_requisicoes_compra` para registrar itens faltantes e processo de compra.
- Status de compra: `solicitada`, `em_cotacao`, `aprovada`, `comprada`, `recebida`, `cancelada`.

### Permissões e alçadas

- Nova tabela `manutencao_alcadas_aprovacao` por perfil.
- RPC `rpc_manutencao_aprovar` com validação por perfil e limite de valor.
- Seed padrão de alçadas via `seed_default_manutencao_alcadas`.

### Financeiro automático

- Vínculo de manutenção em `contas_financeiras.manutencao_id`.
- RPC `rpc_manutencao_gerar_financeiro` para gerar conta a pagar automática.
- Trigger `trg_manutencao_auto_financeiro` ao concluir manutenção com custo.

### Preventivas automáticas

- Nova tabela `manutencao_planos_preventivos`.
- RPC `rpc_manutencao_gerar_preventivas` para gerar manutenções preventivas vencidas.

### Indicadores

- RPC `rpc_manutencao_indicadores` com métricas chave:
  - total
  - concluídas
  - pendentes
  - urgentes
  - custo total
  - tempo parado (horas)

### Novas telas no painel

- `src/app/(painel)/manutencao/compras/page.tsx`
- `src/app/(painel)/manutencao/preventivas/page.tsx`
- `src/app/(painel)/manutencao/indicadores/page.tsx`

### Sidebar / navegação

- Submenu de manutenção expandido com:
  - Compras da manutenção
  - Preventivas
  - Indicadores
