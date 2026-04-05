#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

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
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '').trim();
const E2E_EMPRESA_EMAIL = (process.env.E2E_EMPRESA_EMAIL || 'e2e.billing@example.com').trim();

if (!API_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

let supabase;

async function getSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(API_URL, SERVICE_ROLE, {
    auth: { persistSession: false }
  });
  return supabase;
}

async function createEmpresa() {
  const client = await getSupabase();
  const { data: existingRows, error: selectError } = await client
    .from('empresas')
    .select('id, nome, email')
    .eq('email', E2E_EMPRESA_EMAIL)
    .limit(1);

  if (selectError) throw selectError;
  if (existingRows?.length) return { data: existingRows[0], created: false };

  const { data, error } = await client
    .from('empresas')
    .insert({ nome: 'E2E Empresa', email: E2E_EMPRESA_EMAIL })
    .select('id, nome, email')
    .single();

  if (!error) return { data, created: true };

  const { data: retryRows, error: retryError } = await client
    .from('empresas')
    .select('id, nome, email')
    .eq('email', E2E_EMPRESA_EMAIL)
    .limit(1);

  if (retryError) throw retryError;
  if (retryRows?.length) return { data: retryRows[0], created: false };

  throw error;
}

async function createAssinatura(empresa_id) {
  const client = await getSupabase();
  const { data: existingRows, error: selectError } = await client
    .from('assinaturas')
    .select('id, empresa_id, status, billing_model')
    .eq('empresa_id', empresa_id)
    .in('status', ['past_due', 'ativa'])
    .limit(1);

  if (selectError) throw selectError;
  if (existingRows?.length) return { data: existingRows[0], created: false };

  const { data, error } = await client
    .from('assinaturas')
    .insert({ empresa_id, status: 'past_due' })
    .select('id, empresa_id, status, billing_model')
    .single();

  if (!error) return { data, created: true };

  const { data: retryRows, error: retryError } = await client
    .from('assinaturas')
    .select('id, empresa_id, status, billing_model')
    .eq('empresa_id', empresa_id)
    .in('status', ['past_due', 'ativa'])
    .limit(1);

  if (retryError) throw retryError;
  if (retryRows?.length) return { data: retryRows[0], created: false };

  throw error;
}

async function createFatura(empresa_id, assinatura_id) {
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

  const venc = new Date();
  venc.setDate(venc.getDate() + 5);
  const { data, error } = await client
    .from('faturas')
    .insert({ empresa_id, assinatura_id, valor_centavos: 9900, status: 'aberta', vencimento: venc.toISOString().slice(0, 10) })
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

async function createCheckout(fatura_id) {
  const res = await fetch(`${API_URL}/functions/v1/mp-create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify({ fatura_id, method: 'checkout' }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(`[mp-create-payment] ${json.error || `HTTP ${res.status}`}`);
  }

  return json;
}

async function adminMarkPaid(fatura_id) {
  const client = await getSupabase();
  const { data, error } = await client.rpc('admin_mark_paid', { p_fatura_id: fatura_id });
  if (error) throw error;
  return data;
}

async function getAssinatura(id) {
  const client = await getSupabase();
  const { data, error } = await client.from('assinaturas').select('*').eq('id', id).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function run() {
  console.log('Starting E2E test...');
  const empResult = await createEmpresa();
  const emp = empResult.data;
  console.log(`Empresa ${empResult.created ? 'criada' : 'reutilizada'}:`, emp?.id);

  const assinResult = await createAssinatura(emp.id);
  const assin = assinResult.data;
  console.log(`Assinatura ${assinResult.created ? 'criada' : 'reutilizada'}:`, assin?.id);

  const fatResult = await createFatura(emp.id, assin.id);
  const fat = fatResult.data;
  console.log(`Fatura ${fatResult.created ? 'criada' : 'reutilizada'}:`, fat?.id);

  const checkout = await createCheckout(fat.id);
  console.log('Checkout response:', checkout);
  if (!checkout.preference_id && !checkout.init_point) {
    throw new Error('Checkout sem preference_id/init_point');
  }

  console.log('Simulating payment via admin_mark_paid RPC...');
  const paid = await adminMarkPaid(fat.id);
  console.log('admin_mark_paid result:', paid);

  const assinNow = await getAssinatura(assin.id);
  console.log('Assinatura now:', assinNow);

  if (assinNow?.status === 'ativa' && assinNow?.billing_model === 'modular') {
    console.log('E2E success: assinatura ativa e modular after payment');
    process.exit(0);
  } else {
    console.error('E2E failed: assinatura inconsistente após pagamento', assinNow);
    process.exit(1);
  }
}

run().catch((err) => { console.error(err); process.exit(2); });
