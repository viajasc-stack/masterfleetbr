#!/usr/bin/env bash
set -euo pipefail

echo "Deploy automático: Edge Functions + migrations Supabase"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx não encontrado. Instale Node/npm ou use outra máquina."
  exit 1
fi

SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}" # opcional

echo "1) Deploy das Edge Functions (usa supabase CLI via npx)"
for fn in supabase/functions/*; do
  if [ -d "$fn" ]; then
    name=$(basename "$fn")
    echo "  -> deploy function: $name"
    npx supabase functions deploy "$name" --no-verify-jwt
  fi
done

echo "2) Aplicar migrations automaticamente"
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  echo "   Usando SUPABASE_DB_URL informado."
  npx supabase db push --db-url "$SUPABASE_DB_URL" --include-all --yes
else
  echo "   Tentando projeto vinculado via Supabase CLI."
  npx supabase db push --include-all --yes || {
    echo "   Falha ao aplicar migrations automaticamente."
    echo "   Vincule o projeto (supabase link) ou defina SUPABASE_DB_URL para execução sem interação."
    exit 1
  }
fi

echo "Deploy concluído. Lembre-se de configurar os secrets no Supabase Dashboard:"
echo "  - SUPABASE_SERVICE_ROLE_KEY"
echo "  - MP_ACCESS_TOKEN"
echo "  - MP_WEBHOOK_SECRET"
echo "  - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (frontend)"

echo "Se desejar, rode: npx supabase login && npx supabase link --project-ref <project-ref>"
