#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const API_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

if (!API_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const supabase = createClient(API_URL, SERVICE_ROLE, {
  auth: { persistSession: false }
});

async function createEmpresa() {
  const { data, error } = await supabase.from('empresas').insert({ nome: 'E2E Empresa', email: 'e2e@example.com' }).select().limit(1).single();
  if (error) throw error;
  return data;
}

async function createAssinatura(empresa_id) {
  const { data, error } = await supabase.from('assinaturas').insert({ empresa_id, status: 'past_due' }).select().limit(1).single();
  if (error) throw error;
  return data;
}

async function createFatura(empresa_id, assinatura_id) {
  const venc = new Date();
  venc.setDate(venc.getDate() + 5);
  const { data, error } = await supabase.from('faturas').insert({ empresa_id, assinatura_id, valor_centavos: 9900, status: 'aberta', vencimento: venc.toISOString().slice(0,10) }).select().limit(1).single();
  if (error) throw error;
  return data;
}

async function createCheckout(fatura_id) {
  const res = await fetch(`${API_URL}/functions/v1/mp-create-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify({ fatura_id, method: 'checkout' }),
  });
  return await res.json();
}

async function adminMarkPaid(fatura_id) {
  const { data, error } = await supabase.rpc('admin_mark_paid', { p_fatura_id: fatura_id });
  if (error) throw error;
  return data;
}

async function getAssinatura(id) {
  const { data, error } = await supabase.from('assinaturas').select('*').eq('id', id).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function run() {
  console.log('Starting E2E test...');
  const emp = await createEmpresa();
  console.log('Created empresa:', emp?.id);
  const assin = await createAssinatura(emp.id);
  console.log('Created assinatura:', assin?.id);
  const fat = await createFatura(emp.id, assin.id);
  console.log('Created fatura:', fat?.id);

  const checkout = await createCheckout(fat.id);
  console.log('Checkout response:', checkout);

  console.log('Simulating payment via admin_mark_paid RPC...');
  const paid = await adminMarkPaid(fat.id);
  console.log('admin_mark_paid result:', paid);

  const assinNow = await getAssinatura(assin.id);
  console.log('Assinatura now:', assinNow);

  if (assinNow?.status === 'ativa') {
    console.log('E2E success: assinatura ativa after payment');
    process.exit(0);
  } else {
    console.error('E2E failed: assinatura not active', assinNow);
    process.exit(1);
  }
}

run().catch((err) => { console.error(err); process.exit(2); });
