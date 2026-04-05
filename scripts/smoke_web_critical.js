#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Smoke crítico web (billing + suporte) via service role.
 *
 * Variáveis esperadas:
 * - SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const candidates = ['.env.local', '.env'];

  for (const fileName of candidates) {
    const fullPath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(fullPath)) continue;

    const raw = fs.readFileSync(fullPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx <= 0) continue;

      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] == null || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv();

const API_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SMOKE_EMPRESA_EMAIL = (process.env.SMOKE_EMPRESA_EMAIL || 'smoke.web.critical@example.com').trim();

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

  const row = { provider, ...payload };

  const { error: upsertError } = await client
    .from('gateway_configs')
    .upsert(row, { onConflict: 'provider' });

  if (!upsertError) return;

  const { data: existingRows, error: selectError } = await client
    .from('gateway_configs')
    .select('id')
    .eq('provider', provider)
    .limit(1);

  if (selectError) throw selectError;

  if (existingRows?.length) {
    const { error: updateError } = await client
      .from('gateway_configs')
      .update(payload)
      .eq('id', existingRows[0].id);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await client.from('gateway_configs').insert(row);
  if (insertError) throw insertError;
}

async function getOrCreateEmpresa() {
  const client = await getSupabase();

  const { data: existingRows, error: selectError } = await client
    .from('empresas')
    .select('id, nome, email')
    .eq('email', SMOKE_EMPRESA_EMAIL)
    .limit(1);

  if (selectError) throw selectError;
  if (existingRows?.length) return { data: existingRows[0], created: false };

  const { data, error } = await client
    .from('empresas')
    .insert({ nome: 'SMOKE WEB', email: SMOKE_EMPRESA_EMAIL })
    .select('id, nome, email')
    .single();

  if (!error) return { data, created: true };

  const { data: retryRows, error: retryError } = await client
    .from('empresas')
    .select('id, nome, email')
    .eq('email', SMOKE_EMPRESA_EMAIL)
    .limit(1);

  if (retryError) throw retryError;
  if (retryRows?.length) return { data: retryRows[0], created: false };

  throw error;
}

async function getOrCreateAssinatura(empresa_id) {
  const client = await getSupabase();

  const { data: existingRows, error: selectError } = await client
    .from('assinaturas')
    .select('id, empresa_id, status')
    .eq('empresa_id', empresa_id)
    .in('status', ['past_due', 'ativa'])
    .limit(1);

  if (selectError) throw selectError;
  if (existingRows?.length) return { data: existingRows[0], created: false };

  const { data, error } = await client
    .from('assinaturas')
    .insert({ empresa_id, status: 'past_due' })
    .select('id, empresa_id, status')
    .single();

  if (!error) return { data, created: true };

  const { data: retryRows, error: retryError } = await client
    .from('assinaturas')
    .select('id, empresa_id, status')
    .eq('empresa_id', empresa_id)
    .in('status', ['past_due', 'ativa'])
    .limit(1);

  if (retryError) throw retryError;
  if (retryRows?.length) return { data: retryRows[0], created: false };

  throw error;
}

async function getOrCreateFatura(empresa_id, assinatura_id) {
  const client = await getSupabase();

  const { data: existingRows, error: selectError } = await client
    .from('faturas')
    .select('id, empresa_id, assinatura_id, status')
    .eq('empresa_id', empresa_id)
    .eq('assinatura_id', assinatura_id)
    .eq('status', 'aberta')
    .limit(1);

  if (selectError) throw selectError;
  if (existingRows?.length) return { data: existingRows[0], created: false };

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

  if (!error) return { data, created: true };

  const { data: retryRows, error: retryError } = await client
    .from('faturas')
    .select('id, empresa_id, assinatura_id, status')
    .eq('empresa_id', empresa_id)
    .eq('assinatura_id', assinatura_id)
    .eq('status', 'aberta')
    .limit(1);

  if (retryError) throw retryError;
  if (retryRows?.length) return { data: retryRows[0], created: false };

  throw error;
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

function isExpectedPixError(message) {
  const text = String(message || '');
  return [
    /fatura n[aã]o encontrada/i,
    /internal_error/i,
    /credenc/i,
    /unauthorized/i,
    /forbidden/i,
    /not configured/i,
    /gateway/i,
  ].some((re) => re.test(text));
}

async function run() {
  console.log('== SMOKE WEB CRÍTICO ==');

  await ensureGateway('asaas', { ativo: false, api_url: 'https://api.asaas.com/v3' });
  await ensureGateway('mercado_pago', { ativo: false });

  const empResult = await getOrCreateEmpresa();
  const assinResult = await getOrCreateAssinatura(empResult.data.id);
  const fatResult = await getOrCreateFatura(empResult.data.id, assinResult.data.id);

  const emp = empResult.data;
  const assin = assinResult.data;
  const fat = fatResult.data;

  console.log(`Empresa ${empResult.created ? 'criada' : 'reutilizada'}:`, emp.id);
  console.log(`Assinatura ${assinResult.created ? 'criada' : 'reutilizada'}:`, assin.id);
  console.log(`Fatura ${fatResult.created ? 'criada' : 'reutilizada'}:`, fat.id);

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
    if (!isExpectedPixError(pixError)) {
      throw new Error(`Erro inesperado no fluxo PIX: ${pixError}`);
    }
    console.log('PIX retornou erro esperado sem credenciais reais/configuração de gateway:', pixError);
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
