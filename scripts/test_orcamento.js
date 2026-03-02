const API_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '').trim();

if (!API_URL || !SERVICE_ROLE) {
  console.error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(2);
}

let supabase;

async function getSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(API_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  return supabase;
}

async function run() {
  const client = await getSupabase();
  console.log('Starting orcamento test...');

  // Determine an empresa to assign (service role doesn't populate minha_empresa_id)
  const { data: someEmp, error: empErr } = await client.from('empresas').select('id').limit(1).single();
  if (empErr || !someEmp) {
    console.error('No empresa found to use for test', empErr);
    if (empErr?.message?.toLowerCase?.().includes('invalid api key')) {
      console.error('Dica: confira se NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são do mesmo projeto Supabase.');
    }
    process.exit(2);
  }
  const empresa_id = someEmp.id;

  // Create an orcamento eventual (assign empresa_id explicitly)
  const { data: orc, error: err1 } = await client
    .from('orcamentos')
    .insert({ empresa_id, nome: 'E2E Orçamento Test', descricao: 'Teste de criação', tipo: 'eventual', valor_centavos: 50000 })
    .select()
    .single();
  if (err1) { console.error('Insert orcamento error:', err1); process.exit(2); }
  console.log('Created orcamento:', orc.id);

  // Approve it
  const { data: up, error: err2 } = await client.from('orcamentos').update({ status: 'aprovado' }).eq('id', orc.id).select().single();
  if (err2) { console.error('Update orcamento error:', err2); process.exit(2); }
  console.log('Updated orcamento status to:', up.status);

  // Check ordens_servico created
  const { data: oss, error: err3 } = await client.from('ordens_servico').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).limit(5);
  if (err3) { console.error('Query ordens_servico error:', err3); process.exit(2); }
  console.log('Recent ordens_servico (top 5):', oss.slice(0,5));

  // Check notifications
  const { data: nots, error: err4 } = await client.from('notifications').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).limit(5);
  if (err4) { console.error('Query notifications error:', err4); process.exit(2); }
  console.log('Recent notifications (top 5):', nots.slice(0,5));

  // Create a recurring orcamento -> should create contrato
  const contratoNomeTeste = 'E2E Recorrente';
  const { count: contratosAntes, error: errBefore } = await client
    .from('contratos')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresa_id)
    .eq('nome', contratoNomeTeste)
    .is('cliente_id', null);
  if (errBefore) { console.error('Count contratos(before) error:', errBefore); process.exit(2); }

  const { data: orc2, error: err5 } = await client
    .from('orcamentos')
    .insert({ empresa_id, nome: contratoNomeTeste, descricao: 'Teste recorrente', tipo: 'recorrencia', valor_centavos: 100000 })
    .select()
    .single();
  if (err5) { console.error('Insert orcamento2 error:', err5); process.exit(2); }
  console.log('Created recurring orcamento:', orc2.id);

  const { data: up2, error: err6 } = await client.from('orcamentos').update({ status: 'aprovado' }).eq('id', orc2.id).select().single();
  if (err6) { console.error('Update orcamento2 error:', err6); process.exit(2); }
  console.log('Updated recurring orcamento status to:', up2.status);

  // Check contratos
  const { data: contrs, error: err7 } = await client.from('contratos').select('*').eq('empresa_id', empresa_id).order('created_at', { ascending: false }).limit(5);
  if (err7) { console.error('Query contratos error:', err7); process.exit(2); }
  console.log('Recent contratos (top 5):', contrs.slice(0,5));

  const { count: contratosDepois, error: errAfter } = await client
    .from('contratos')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresa_id)
    .eq('nome', contratoNomeTeste)
    .is('cliente_id', null);
  if (errAfter) { console.error('Count contratos(after) error:', errAfter); process.exit(2); }

  console.log('Contratos recorrentes (cliente_id null) antes/depois:', contratosAntes, contratosDepois);
  if ((contratosDepois ?? 0) > (contratosAntes ?? 0)) {
    console.error('Falha de dedupe: aprovacao recorrente criou contrato duplicado para nome+cliente_id(null).');
    process.exit(1);
  }

  console.log('Orcamento test finished successfully.');
  process.exit(0);
}

run().catch((e)=>{ console.error(e); process.exit(2); });
