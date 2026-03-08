# URL personalizada — Plano Supremo/Top

## O que foi implementado

Foi implementada a base técnica de URL personalizada para empresas no plano **Supremo/Top**:

1. **Banco (migration)**
   - Arquivo: `supabase/migrations/20260307094000_url_personalizada_plano_supremo.sql`
   - Novos campos em `empresas`:
     - `subdominio_personalizado`
     - `dominio_personalizado`
     - `dominio_status` (`desativado | pendente | ativo | erro`)
     - `dominio_ssl_status` (`pendente | ativo | erro`)
     - `dominio_verificado_em`
     - `dominio_erro`
   - Índices únicos para evitar host duplicado.

2. **RPCs principais**
   - `get_my_custom_domain()`
   - `set_my_custom_subdomain(p_subdomain text)`
   - `set_my_custom_domain(p_domain text)`
   - `clear_my_custom_domain()`
   - `resolve_tenant_by_host(p_host text)`
   - `master_set_empresa_domain_status(...)` (operação master)

3. **Regra de plano**
   - Função `is_top_or_supremo_plan(p_empresa_id uuid)`
   - Libera configuração somente para assinatura ativa/trial com `planos.codigo` em `top` ou `supremo`.

4. **UI no painel da empresa**
   - Arquivo: `src/app/(painel)/configuracoes/page.tsx`
   - Nova seção “URL personalizada (plano Supremo/Top)”:
     - modo subdomínio da plataforma;
     - modo domínio próprio;
     - feedback de status/SSL/erro;
     - remoção da configuração.

5. **Roteamento por host**
   - Arquivo: `src/proxy.ts`
   - Resolve tenant por host via RPC `resolve_tenant_by_host`.
   - Para host não reconhecido, redireciona com fallback para domínio principal.

---

## Variáveis de ambiente usadas no proxy

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE_DOMAIN` (default: `masterfleetbr.com.br`)
- `NEXT_PUBLIC_APP_HOSTS` (lista adicional de hosts “plataforma”, separados por vírgula)
- `NEXT_PUBLIC_APP_FALLBACK_URL` (default: `https://<BASE_DOMAIN>`)

---

## Fluxo operacional recomendado (DNS + SSL)

1. Empresa configura subdomínio/domínio no painel.
2. Sistema grava status como `pendente`.
3. Equipe operacional (master/devops) valida DNS apontando para a infraestrutura.
4. Provisiona/valida SSL.
5. Atualiza status com RPC master:
   - `master_set_empresa_domain_status(p_empresa_id, 'ativo', 'ativo', null)`
6. A partir daí, `resolve_tenant_by_host` passa a resolver o tenant pelo host.

---

## Limitações atuais

- Esta entrega **não** cria DNS automaticamente.
- Esta entrega **não** emite SSL automaticamente.
- A ativação final depende do passo operacional via `master_set_empresa_domain_status`.
- Para produção multi-domínio completa, recomenda-se integrar um provedor DNS/SSL (Cloudflare, Route53, Vercel Domains etc.).
