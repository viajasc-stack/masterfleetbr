/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');

const ROOT = '/Users/fernandofavero/Documents/masterfleetbr';
const MOTORISTA_ASSETS = path.join(ROOT, 'masterfleetbr-motorista', 'assets');
const OUT_ICON = path.join(MOTORISTA_ASSETS, 'icon.png');

function getEnv(name) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

async function main() {
  const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Defina SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const { data: bundle, error: bundleError } = await supabase.rpc('master_get_config_bundle');
  if (bundleError) throw new Error(`Erro ao ler bundle master: ${bundleError.message}`);

  const settings = (bundle && bundle.settings) || {};
  const appCfg = settings.apps_masterfleetbr_motorista || {};
  const iconUrl = appCfg.app_icon_url;

  if (!iconUrl || typeof iconUrl !== 'string') {
    throw new Error('Nenhum app_icon_url configurado em settings.apps_masterfleetbr_motorista.');
  }

  const response = await fetch(iconUrl);
  if (!response.ok) {
    throw new Error(`Falha no download do ícone (${response.status}): ${iconUrl}`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('image')) {
    throw new Error(`URL não retornou imagem válida. content-type: ${contentType || 'desconhecido'}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!fs.existsSync(MOTORISTA_ASSETS)) {
    throw new Error(`Diretório de assets não encontrado: ${MOTORISTA_ASSETS}`);
  }

  fs.writeFileSync(OUT_ICON, buffer);

  console.log('✅ Ícone sincronizado com sucesso:');
  console.log(`- origem: ${iconUrl}`);
  console.log(`- destino: ${OUT_ICON}`);
  console.log('⚠️ Próximo passo: gere novo build nativo do app para refletir no ícone instalado.');
}

main().catch((err) => {
  console.error('❌ sync:icon:motorista falhou');
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
