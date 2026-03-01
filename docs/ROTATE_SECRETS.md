# Rotacionar tokens e segredos (instruções)

Siga estes passos para rotacionar tokens expostos e proteger o projeto:

1. **GitHub Personal Access Token**
   - Vá para https://github.com/settings/tokens
   - Revogue o token exposto.
   - Gere um novo token com permissões necessárias (repo, workflow).
   - Atualize locais que usam o token (CLI, CI secrets).

2. **Supabase Service Role**
   - No painel do Supabase -> Settings -> API, gere uma nova `service_role` key.
   - Atualize variáveis de ambiente do CI e do ambiente de deploy (ex.: GitHub Secrets `SUPABASE_SERVICE_ROLE_KEY`).
   - Não exponha essa variável em logs nem em arquivos públicos.

3. **Other secrets**
   - Verifique `NEXT_PUBLIC_*` chaves: apenas as públicas devem ficar prefixadas com `NEXT_PUBLIC_`.
   - Use um Secret Manager (GitHub Secrets, Vault, AWS Secrets Manager) para armazenar chaves privadas.

4. **Re-deploy**
   - Após rotacionar, reinicie serviços que dependem das chaves (Edge Functions, Workers).

5. **Audit**
   - Procure no histórico por commits que possam ter exposto segredos e remova-os da história se necessário.

If you want, I can open a PR with the instructions and candidate workflow changes, and prepare a checklist for rotation.