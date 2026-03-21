# Etapa 8 — Persistência de eventos críticos (Supabase)

## Objetivo
Salvar eventos críticos de observabilidade fora do console do browser, criando histórico consultável por empresa.

## Entregas

### 1) Migração SQL
Arquivo: `supabase/migrations/20260321073000_create_observability_events.sql`

Foi criada a tabela `public.observability_events` com:
- `empresa_id`
- `scope`
- `level` (`warn` ou `error`)
- `message`
- `event_kind` (`log` ou `alert`)
- `meta` (jsonb)
- `created_at`

Inclui também:
- índices por `empresa_id+created_at`, `scope+created_at`, `level+created_at`
- trigger de preenchimento automático de `empresa_id` via `minha_empresa_id()`
- RLS com policies de `SELECT` e `INSERT` por empresa

### 2) Integração no utilitário de observabilidade
Arquivo: `src/lib/observability.ts`

Regras aplicadas:
- `logError` passa a persistir evento crítico em `observability_events` (`event_kind=log`)
- alerta de burst (`[obs][alert]`) também persiste (`event_kind=alert`)
- falhas de persistência não quebram fluxo funcional
- throttle de aviso de persistência (`[obs][persist]`) para evitar ruído em loop

## Resultado
- Eventos críticos ficam disponíveis para histórico e análise por tenant.
- Base pronta para evoluir para dashboard/alerta externo (email/webhook/edge function).

## Próximo passo sugerido (Etapa 9)
- Criar tela administrativa para consulta de `observability_events` com filtros por:
  - período
  - scope
  - severidade
  - tipo do evento (log/alert)
