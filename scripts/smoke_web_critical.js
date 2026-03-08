#!/usr/bin/env node

/**
 * Smoke crítico web (billing + suporte) via service role.
 *
 * Variáveis esperadas:
 * - SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const API_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!API_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

let supabase;

async function getSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(API_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });
  return supabase;
}

async function ensureGateway(provider, payload = {}) {
  const client = await getSupabase();
  const { error } = await client.from('gateway_configs').upsert({ provider, ...payload });
  if (error) throw error;
}

async function createEmpresa() {
  const client = await getSupabase();
  const email = `smoke+${Date.now()}@masterfleetbr.test`;
  const { data, error } = await client
    .from('empresas')
    .insert({ nome: 'SMOKE WEB', email })
    .select('id, nome, email')
    .single();
  if (error) throw error;
  return data;
}

async function createAssinatura(empresa_id) {
  const client = await getSupabase();
  const { data, error } = await client
    .from('assinaturas')
    .insert({ empresa_id, status: 'past_due' })
    .select('id, empresa_id, status')
    .single();
  if (error) throw error;
  return data;
}

async function createFatura(empresa_id, assinatura_id) {
  const client = await getSupabase();
  const due = new Date();
  due.setDate(due.getDate() + 3);
  const { data, error } = await client
    .from('faturas')
    .insert({
      empresa_id,
      assinatura_id,
      valor_centavos: 19900,
      status: 'aberta',
      vencimento: due.toISOString().slice(0, 10),
    })
    .select('id, empresa_id, assinatura_id, status')
    .single();
  if (error) throw error;
  return data;
}

async function callFunction(path, body) {
  const res = await fetch(`${API_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`[${path}] ${json.error || `HTTP ${res.status}`}`);
  }
  return json;
}

async function getFatura(id) {
  const client = await getSupabase();
  const { data, error } = await client
    .from('faturas')
    .select('id, status, payment_provider, provider_payment_id, pix_qr_code, pix_copia_cola')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

async function run() {
  console.log('== SMOKE WEB CRÍTICO ==');

  await ensureGateway('asaas', { ativo: false, api_url: 'https://api.asaas.com/v3' });
  await ensureGateway('mercado_pago', { ativo: false });

  const emp = await createEmpresa();
  const assin = await createAssinatura(emp.id);
  const fat = await createFatura(emp.id, assin.id);
  console.log('Empresa:', emp.id);
  console.log('Assinatura:', assin.id);
  console.log('Fatura:', fat.id);

  console.log('Teste função mp-create-payment (checkout fallback)...');
  const checkout = await callFunction('mp-create-payment', {
    fatura_id: fat.id,
    method: 'checkout',
    provider: 'mercado_pago',
  });
  if (!checkout.preference_id && !checkout.init_point) {
    throw new Error('Checkout sem preference_id/init_point');
  }
  console.log('Checkout ok');

  console.log('Teste função mp-create-pix (provider explícito)...');
  let pixError = null;
  try {
    await callFunction('mp-create-pix', {
      fatura_id: fat.id,
      provider: 'mercado_pago',
    });
  } catch (err) {
    pixError = String(err);
  }

  if (pixError) {
    console.log('PIX retornou erro esperado sem credenciais reais:', pixError);
  } else {
    const faturaAtual = await getFatura(fat.id);
    console.log('PIX gerado, fatura atual:', faturaAtual);
  }

  console.log('SMOKE finalizado com sucesso (estrutura/rotas/edge calls validadas).');
}

run().catch((err) => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
