const { createClient } = require('@supabase/supabase-js');

const API_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!API_URL || !SERVICE_ROLE) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(2);
}

const supabase = createClient(API_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function run() {
  console.log('Starting orcamento test...');

  // Determine an empresa to assign (service role doesn't populate minha_empresa_id)
  const { data: someEmp, error: empErr } = await supabase.from('empresas').select('id').limit(1).single();
  if (empErr || !someEmp) { console.error('No empresa found to use for test', empErr); process.exit(2); }
  const empresa_id = someEmp.id;

  // Create an orcamento eventual (assign empresa_id explicitly)
  const { data: orc, error: err1 } = await supabase
    .from('orcamentos')
    .insert({ empresa_id, nome: 'E2E Orçamento Test', descricao: 'Teste de criação', tipo: 'eventual', valor_centavos: 50000 })
    .select()
    .single();
  if (err1) { console.error('Insert orcamento error:', err1); process.exit(2); }
  console.log('Created orcamento:', orc.id);

  // Approve it
  const { data: up, error: err2 } = await supabase.from('orcamentos').update({ status: 'aprovado' }).eq('id', orc.id).select().single();
  if (err2) { console.error('Update orcamento error:', err2); process.exit(2); }
  console.log('Updated orcamento status to:', up.status);

  // Check ordens_servico created
  const { data: oss, error: err3 } = await supabase.from('ordens_servico').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).limit(5);
  if (err3) { console.error('Query ordens_servico error:', err3); process.exit(2); }
  console.log('Recent ordens_servico (top 5):', oss.slice(0,5));

  // Check notifications
  const { data: nots, error: err4 } = await supabase.from('notifications').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).limit(5);
  if (err4) { console.error('Query notifications error:', err4); process.exit(2); }
  console.log('Recent notifications (top 5):', nots.slice(0,5));

  // Create a recurring orcamento -> should create contrato
  const { data: orc2, error: err5 } = await supabase
    .from('orcamentos')
    .insert({ empresa_id, nome: 'E2E Recorrente', descricao: 'Teste recorrente', tipo: 'recorrencia', valor_centavos: 100000 })
    .select()
    .single();
  if (err5) { console.error('Insert orcamento2 error:', err5); process.exit(2); }
  console.log('Created recurring orcamento:', orc2.id);

  const { data: up2, error: err6 } = await supabase.from('orcamentos').update({ status: 'aprovado' }).eq('id', orc2.id).select().single();
  if (err6) { console.error('Update orcamento2 error:', err6); process.exit(2); }
  console.log('Updated recurring orcamento status to:', up2.status);

  // Check contratos
  const { data: contrs, error: err7 } = await supabase.from('contratos').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).limit(5);
  if (err7) { console.error('Query contratos error:', err7); process.exit(2); }
  console.log('Recent contratos (top 5):', contrs.slice(0,5));

  console.log('Orcamento test finished successfully.');
  process.exit(0);
}

run().catch((e)=>{ console.error(e); process.exit(2); });
