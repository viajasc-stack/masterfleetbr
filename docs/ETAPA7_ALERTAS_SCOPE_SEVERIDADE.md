# Etapa 7 — Alertas por scope e severidade (baseline)

## Objetivo
Adicionar uma camada mínima de alerta para acelerar detecção de incidentes sem depender de stack externa.

## Implementação

Arquivo principal: `src/lib/observability.ts`

### Novidades
1. **Novo nível de log**: `warn`
   - função `logWarn(scope, message, meta?)`

2. **Detecção de pico de erros por scope**
   - Janela: `60s`
   - Limiar: `5 erros`
   - Ao atingir limiar, emite alerta:
     - prefixo: `[obs][alert]`
     - severidade: `warn`
     - metadados: `errors_in_window`, `window_ms`

3. **Controle anti-ruído**
   - após disparar alerta para um scope, só volta a alertar após passar a janela.

## Como usar
- Continue usando `logInfo` / `logError` normalmente.
- Use `logWarn` para condições relevantes não-fatais (degradação, fallback, timeout parcial, etc.).
- Monitore no console por:
  - `[obs]` para eventos normais
  - `[obs][alert]` para picos de erro

## Critérios iniciais recomendados
- Se `[obs][alert]` repetir para o mesmo scope em sequência, tratar como incidente ativo.
- Priorizar scopes de faturamento, assinatura e ordens de serviço.

## Próximo passo (Etapa 8)
- Persistir eventos críticos em tabela de auditoria (ou webhook) para histórico e alertas fora do browser.
