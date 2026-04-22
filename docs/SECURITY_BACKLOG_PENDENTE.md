## Backlog de Segurança (pendente para fechamento do projeto)

Data: 2026-04-22

Objetivo: registrar os achados da varredura rápida de cibersegurança para correção em lote ao final do projeto.

---

## Itens críticos levantados

### 1) `notifications/mark-read` com autorização insuficiente
- Arquivo: `src/app/api/notifications/mark-read/route.ts`
- Risco: atualização de notificações por `ids` sem validação forte de tenant/usuário (IDOR/BOLA).
- Ação futura:
  - tornar autenticação obrigatória;
  - validar pertencimento por `empresa_id` e/ou `user_id` no update;
  - bloquear operação sem token válido.

### 2) `observability/alert` confiando em `empresa_id` no body
- Arquivo: `src/app/api/observability/alert/route.ts`
- Risco: spoofing de alertas e abuso de canais (webhook/email/whatsapp) quando sem auth robusta.
- Ação futura:
  - exigir autenticação obrigatória **ou** assinatura/HMAC/API key de servidor;
  - não aceitar `empresa_id` de body sem validação por identidade autenticada.

---

## Itens altos/médios

### 3) Uso de `SUPABASE_SERVICE_ROLE_KEY` em rotas server
- Escopo observado: `telemetria/eventos`, `masteria/_lib`, `google-calendar/_lib`, `notifications/mark-read`, `observability/alert`.
- Risco: impacto ampliado se faltar validação de autorização.
- Ação futura:
  - padronizar guard server-side (auth + tenant + role) para todas as rotas;
  - revisar cada endpoint com checklist único de autorização.

### 4) Cookie de tenant com `httpOnly: false`
- Arquivo: `src/proxy.ts`
- Risco: superfície maior para manipulação client-side (baixo/médio, dependendo do uso).
- Ação futura:
  - reavaliar necessidade;
  - se possível, migrar para `httpOnly: true` ou reduzir dependência desse cookie.

### 5) Endpoints públicos sem rate limit dedicado
- Exemplo: `src/app/api/cnpj/[cnpj]/route.ts`
- Risco: abuso por automação e consumo excessivo de APIs externas.
- Ação futura:
  - aplicar rate limit por IP/chave;
  - adicionar logs e bloqueio progressivo em abuso.

---

## Plano de execução (quando entrar no hardening final)

1. Fechar gaps críticos de auth/tenant (`notifications/mark-read` e `observability/alert`).
2. Criar middleware/guard padrão para todas as rotas sensíveis.
3. Revisão endpoint a endpoint com checklist de autorização.
4. Aplicar rate limit e proteção anti-abuso em rotas públicas.
5. Revisar headers de segurança globais (CSP/HSTS/X-Frame-Options etc.).
6. Rodar rodada final de testes de regressão + segurança (manual e automatizada).

---

## Observação importante

Meta realista de segurança: reduzir drasticamente risco e superfície de ataque com boas práticas e monitoramento contínuo.
Em software web não existe garantia absoluta de “100% sem chance de invasão”, mas é possível atingir um nível muito alto de proteção operacional.
