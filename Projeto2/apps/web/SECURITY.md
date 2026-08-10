# Segurança de dados — LOVIX Web

## Princípios obrigatórios

- O frontend usa somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Nunca execute scripts locais com `SUPABASE_SERVICE_ROLE_KEY` dentro de `apps/web`.
- Service Role, tokens de pagamento, senha do banco e tokens da Supabase devem ficar apenas em backend/Edge Functions/CI protegida.
- Dados sensíveis do próprio perfil são lidos pela RPC `get_my_profile`; listagens públicas usam seleção reduzida de colunas.

## Fluxo seguro de banco

Use as migrations versionadas em `supabase/migrations`:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Não use scripts antigos de setup/seed com Service Role no frontend. Eles foram removidos para evitar uso acidental de privilégios administrativos.

## Pagamentos

Pagamentos Premium devem ser implementados apenas por backend privado ou Supabase Edge Functions. Tokens do Mercado Pago, segredos de webhook e Service Role devem ser cadastrados como secrets do ambiente seguro, nunca em arquivos do frontend.

## Checklist antes de produção

- [ ] Aplicar todas as migrations, incluindo `20260809000100_lovix_security_hardening.sql`.
- [ ] Conferir Auth Site URL e Redirect URLs.
- [ ] Confirmar que `.env` e `.env.local` não estão versionados.
- [ ] Testar RLS com dois usuários comuns e um usuário Premium.
- [ ] Implementar pagamento somente via backend/Edge Function com secrets protegidos.
