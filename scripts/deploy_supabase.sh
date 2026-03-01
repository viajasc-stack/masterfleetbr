#!/usr/bin/env bash
set -euo pipefail

echo "Deploy automático: Edge Functions + (opcional) migrations via psql"

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

echo "2) (Opcional) Aplicar migrations SQL localmente via PSQL"
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "   SUPABASE_DB_URL não definida — pulando migrations."
  echo "   Para aplicar migrations: export SUPABASE_DB_URL=\"postgres://...\" e execute este script novamente."
else
  if ! command -v psql >/dev/null 2>&1; then
    echo "   psql não encontrado. Instale psql para aplicar migrations automaticamente." 
  else
    echo "   Aplicando arquivos em supabase/migrations/*.sql"
    for f in supabase/migrations/*.sql; do
      echo "     -> aplicando: $f"
      psql "$SUPABASE_DB_URL" -f "$f"
    done
  fi
fi

echo "Deploy concluído. Lembre-se de configurar os secrets no Supabase Dashboard:"
echo "  - SUPABASE_SERVICE_ROLE_KEY"
echo "  - MP_ACCESS_TOKEN"
echo "  - MP_WEBHOOK_SECRET"
echo "  - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (frontend)"

echo "Se desejar, rode: npx supabase login && npx supabase link --project-ref <project-ref>"
