# MasterFleetBR - Setup do zero

## 1. Banco de dados (Supabase)

Após **deletar todas as tabelas** no Supabase, execute no **SQL Editor**:

```
supabase/migrations/20250228100000_schema_inicial.sql
```

Copie o conteúdo do arquivo e execute no SQL Editor.

## 2. Configuração de Auth (Supabase)

No **Supabase Dashboard** → **Authentication** → **Providers** → **Email**:

- Para desenvolvimento: desative **"Confirm email"** se quiser que o cadastro funcione imediatamente sem confirmar email.
- Para produção: mantenha ativado e configure o fluxo de confirmação.

## 3. Variáveis de ambiente

O arquivo `.env.local` já deve conter:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 4. Rodar o projeto

```bash
npm run dev
```

Acesse: http://localhost:3000

## 5. Fluxo

1. **/** → Página inicial com 2 botões
2. **Teste grátis por 7 dias** → Cadastro (cria empresa + usuário + trial)
3. **Entrar no sistema** → Login
4. **/dashboard** → Área logada (após login ou cadastro)
