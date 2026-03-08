# Status do progresso — 04/03/2026

## ✅ Entregas concluídas

### Desvio de rota geométrico (v2)
- Migração criada: `supabase/migrations/20260304130000_desvio_rota_geometrico.sql`
- Estrutura adicionada em `ordens_servico`:
  - `rota_referencia_lat`
  - `rota_referencia_lng`
  - `raio_desvio_m` (padrão 1500)
- Tabela de posição do motorista: `motoristas_geo`
- Função de distância Haversine: `distance_m_haversine`
- RPC de ping e detecção: `rpc_motorista_geo_ping(...)`
- Evento gerado em `os_eventos`: `desvio_rota_geom` (com throttle)

### App motorista
- Arquivo: `masterfleetbr-motorista/src/lib/geo.js`
  - helper `pingMotoristaGeo(...)` para chamar RPC.
- Arquivo: `masterfleetbr-motorista/src/screens/OSDetailScreen.js`
  - envio de ping de localização no fluxo de confirmação (best-effort).

### Painel web
- Dashboard atualizado para consumir e exibir `desvio_rota_geom`.
- Formulários de OS atualizados para configurar rota/raio:
  - `src/app/(painel)/ordens-servico/[id]/page.tsx` (edição)
  - `src/app/(painel)/ordens-servico/nova/page.tsx` (criação)

## 📌 Lista de afazeres pendentes

1. Aplicar a migration no ambiente alvo (homologação/produção).
2. Preencher rota/raio em OS já existentes (backfill/manual).
3. Validar ponta a ponta em campo (app + evento + dashboard).
4. Definir se haverá alerta em tempo real (push/e-mail/WhatsApp).
5. Melhorar UX com seletor de mapa para lat/lng.
6. Remover warning de lint em `nova/page.tsx` (`eslint-disable` não utilizado).

## 🎯 Próximo foco acordado

Focar agora no **painel administrativo/master** e liberar seu **login de acesso ao painel master**.

## 🔐 Acesso Master (atualização)

- Usuário manual encontrado: `adm@masterfleetbr.com.br`
- `user_id`: `970b47e5-dd3c-4b06-a8be-e6279b9501eb`
- Profile vinculado/ajustado:
  - `nome`: `Administrador Master`
  - `role`: `dono`
  - `empresa_id`: `null`

### Ajuste aplicado para erro de permissão (42501)

O comando `ALTER DATABASE ... SET app.super_admin_uid` falhou por permissão no ambiente.

Para resolver de forma compatível, foi criada a migration:

- `supabase/migrations/20260304154000_fix_super_admin_without_db_setting.sql`

Ela:
- cria tabela `public.super_admins`;
- reescreve `public.is_super_admin()` para validar por essa tabela (com fallback no setting antigo);
- faz seed automático do usuário `adm@masterfleetbr.com.br`.

Após aplicar essa migration, o acesso ao `/master` deve funcionar sem depender de `ALTER DATABASE`.

---

## 🆕 Progresso salvo — Planos por módulos + trial liberado

### ✅ Entregas concluídas agora

1. **Painel Master (visual e estrutura)**
   - Layout master harmonizado com o padrão visual do sistema.
   - Novas áreas no master: Financeiro, Segurança e Operações.

2. **Tela de Planos refeita (Master)**
   - Arquivo: `src/app/(master)/master/planos/page.tsx`
   - Gestão de planos com:
     - código, nome, descrição, valor e ordem;
     - presets (Básico, Intermediário, Top);
     - seleção de módulos por plano;
     - ativar/desativar plano.

3. **Modelagem de planos por módulos (DB)**
   - Migration: `supabase/migrations/20260304180000_planos_por_modulos.sql`
   - `planos` agora possui:
     - `codigo` (unique)
     - `descricao`
     - `modulos` (`jsonb` array com constraint)
   - Seed/upsert dos planos:
     - `basico`
     - `intermediario`
     - `top`

4. **Regra de acesso por módulos implementada**
   - Fonte central: `src/lib/moduleAccess.ts`
   - **Trial = acesso total** (`assinaturas.status = 'trial'`).
   - Fora do trial, acesso por módulos do plano.

5. **Menu dinâmico por módulos**
   - Arquivo: `src/components/layout/Sidebar.tsx`
   - Itens/subitens exibidos conforme módulos contratados.

6. **Bloqueio de rota por módulo**
   - Arquivo: `src/components/auth/AuthGate.tsx`
   - Se rota exigir módulo não contratado: redireciona para `/bloqueado?motivo=modulo`.

7. **UX de bloqueio por módulo**
   - Arquivo: `src/app/(painel)/bloqueado/page.tsx`
   - Mensagem específica para módulo indisponível no plano.

### 📌 Próximos passos (quando retomarmos)

1. Criar tela de **upgrade guiado** (comparativo Básico x Intermediário x Top).
2. Integrar CTA de upgrade/pagamento direto na tela de bloqueio por módulo.
3. Validar ponta a ponta com contas reais em status:
   - `trial`
   - `ativa`
   - `past_due`
   - `bloqueada`
4. Aplicar migrations pendentes no ambiente alvo.

---

## 🧩 Preparação para múltiplos gateways (sem conflito de dados)

Para já deixar a base pronta para futuro (além de Mercado Pago), foi feito um preparo inicial de arquitetura:

### ✅ Banco preparado para provider por pagamento

Migration criada:

- `supabase/migrations/20260304195000_prepare_multi_gateway_payments.sql`

Inclui:

- Em `faturas`:
  - `payment_provider`
  - `provider_payment_id`
  - `provider_external_reference`
  - `provider_payload` (`jsonb`)
- Check constraint de provider permitido:
  - `mercado_pago`, `asaas`, `stripe`, `manual`
- Em `webhook_logs`:
  - `empresa_id`
  - `provider`
- Índice para rastreabilidade por empresa/provedor.

### ✅ Edge Functions já encaminhadas para isolamento por empresa

Arquivos atualizados:

- `supabase/functions/mp-create-pix/index.ts`
- `supabase/functions/mp-create-payment/index.ts`
- `supabase/functions/mp-webhook/index.ts`

Principais ajustes:

- Leitura de `mp_access_token` da empresa (fallback para env global).
- Webhook com query params para contexto:
  - `provider=mercado_pago`
  - `empresa_id=<uuid>`
- Persistência de metadados de provedor em `faturas`.
- `webhook_logs` gravando `provider` + `empresa_id`.

> Isso evita mistura de dados entre empresas e reduz retrabalho quando entrar novo meio de cobrança no futuro.
