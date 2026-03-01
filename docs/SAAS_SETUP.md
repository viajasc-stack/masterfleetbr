# MasterFleetBR – Setup SaaS

## 1. Migrations SQL (Supabase)

Execute no **SQL Editor** do Supabase, na ordem:

### Se suas tabelas `assinaturas` e `faturas` estão no schema **admin**:
```bash
supabase/migrations/20250228000001_admin_rpcs_executable.sql
```

### Se estão no schema **public**:
```bash
supabase/migrations/20250228000002_admin_rpcs_public_schema.sql
```

### Tabela planos (opcional):
```bash
supabase/migrations/20250228000003_create_planos_if_missing.sql
```

---

## 2. Edge Function `mp-create-pix`

### Deploy
```bash
supabase functions deploy mp-create-pix
```

### Secrets obrigatórios
No Supabase Dashboard → Edge Functions → mp-create-pix → Secrets:

| Nome | Descrição |
|------|-----------|
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (produção ou teste) |

---

## 3. Variáveis de ambiente (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 4. RPCs criadas

| RPC | Uso |
|-----|-----|
| `admin.get_empresa_billing(p_empresa_id)` | Detalhe de cobrança da empresa |
| `admin.admin_marcar_fatura_pago(p_empresa_id)` | Marca fatura como paga |
| `admin.admin_estender_trial(p_empresa_id, p_dias)` | Estende trial |
| `admin.admin_trocar_plano(p_empresa_id, p_plano_id)` | Troca plano |
| `admin.admin_reenviar_cobranca(p_empresa_id)` | Placeholder para email |

---

## 5. Fluxo Master → Empresa

1. Acesse `/master/empresas`
2. Clique em **Ver** em uma empresa
3. Use os botões: Gerar PIX, Marcar pago, Estender trial, Trocar plano
