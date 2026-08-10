# LOVIX

LOVIX é uma plataforma social privada para maiores de 18 anos, com perfis individuais ou de casal, descoberta por afinidade e região, publicações, conexões e mensagens Premium. Privacidade, consentimento e moderação são requisitos do produto.

> O produto não é afiliado ao Instagram, Meta ou Mercado Pago.

## Estrutura

```text
apps/web/          # React + Vite, foco desta entrega
apps/mobile/       # base Expo para evolução futura
packages/shared/   # contratos e regras reutilizáveis
supabase/          # migrations, RLS, Storage, views e seed
```

A web app é mobile-first: usa navegação inferior no celular e sidebar no desktop. O pacote compartilhado mantém regras de domínio desacopladas da interface.

## Stack

- React 19, Vite e TypeScript
- React Router e Lucide React
- Supabase Auth, Postgres, Storage e Row Level Security (RLS)
- Migrations SQL versionadas
- Vercel para deploy da SPA

## Entregas atuais

- Autenticação por e-mail, rotas protegidas e onboarding com confirmação de idade e aceite de termos.
- Feed, criação de posts, curtidas, descoberta, perfis, seguir/deixar de seguir e edição segura de perfil.
- Conversas privadas protegidas por RLS e disponíveis a membros Premium.
- Estrutura de banco para planos, pagamentos, denúncias, bloqueios, notificações, auditoria e moderação.
- Buckets e policies de Storage para avatares, capas, posts e stories.

Notificações, configurações detalhadas e painel administrativo continuam como próximas etapas. O banco já possui estrutura para pagamentos e ativação Premium, mas checkout e webhook exigem uma Edge Function ou backend privado — não são simulados no frontend.

## Pré-requisitos

- Node.js 20+
- npm 10+
- Projeto Supabase e acesso à Supabase CLI para aplicar migrations

## Executar localmente

1. Instale as dependências na raiz:

   ```bash
   npm install
   ```

2. Crie e preencha o ambiente público da web:

   ```bash
   cp apps/web/.env.example apps/web/.env
   ```

   ```env
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<sua-chave-anon-publica>
   ```

3. Vincule e aplique as migrations no projeto Supabase:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   As migrations em `supabase/migrations/` criam schema, RLS, Storage, plano Premium e a view `feed_posts`. O `supabase/seed.sql` é vazio intencionalmente: não há contas ou conteúdo de demonstração para o produto adulto.

4. Inicie o frontend:

   ```bash
   npm run dev:web
   ```

   Acesse `http://localhost:5173`. No Supabase, configure essa URL como **Site URL** e nas URLs de redirecionamento do Auth.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev:web` | inicia o Vite da web app |
| `npm run lint:web` | executa o ESLint |
| `npm run build:web` | valida TypeScript e gera `apps/web/dist` |
| `npm run dev:mobile` | inicia a base Expo existente |

## Segurança e ambiente

- O navegador usa somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; a chave anon não substitui as policies RLS.
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, senha do banco, token da Supabase, credenciais de pagamento ou segredos de webhook no frontend ou no Git.
- `apps/web/.env.example` e `supabase/.env.example` são apenas modelos. Arquivos `.env`, `.env.local` e variações são ignorados pelo Git.
- Use credenciais administrativas apenas em scripts confiáveis, CI protegida ou Edge Functions/backends privados.
- Antes de produção, revise RLS, redirects de Auth, CORS, policies de Storage, moderação e a integração de pagamentos.

## Deploy

`vercel.json` gera `apps/web/dist` e redireciona as rotas da SPA para `index.html`. No provedor, defina somente as variáveis públicas abaixo para o build:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon-publica>
```

Para checkout, webhook e ativação de pagamentos, mantenha todos os segredos exclusivamente no backend/Edge Function.

## Próximas etapas

1. Criar Edge Functions para cobranças e webhooks de pagamento.
2. Implementar telas de configurações, notificações e operações administrativas.
3. Conectar os fluxos de denúncia, bloqueio e moderação na interface.
4. Criar testes de integração para RLS, RPCs e jornadas críticas.
5. Evoluir a aplicação Expo com os contratos de `packages/shared`.
