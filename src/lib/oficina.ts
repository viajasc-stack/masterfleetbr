// =============================================================================
// MasterFleetBR - Lib de Oficina (Funções + Helpers)
// =============================================================================
import { supabase } from "@/lib/supabase/client";
import type {
  OficinaOT,
  OficinaMecanico,
  OficinaServicoOT,
  OficinaPecaOT,
  OficinaOrcamento,
  OficinaGarantia,
  OficinaKPIs,
} from "@/types/oficina.types";

// -----------------------------------------------------------------------------
// Helpers de formatação
// -----------------------------------------------------------------------------
export function moeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor ?? 0);
}

export function dataBR(data: string | null | undefined): string {
  if (!data) return "—";
  return new Date(data).toLocaleDateString("pt-BR");
}

export function dataHoraBR(data: string | null | undefined): string {
  if (!data) return "—";
  return new Date(data).toLocaleString("pt-BR");
}

export function formatarTempo(horas: number | null | undefined): string {
  if (!horas) return "—";
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return `${h}h ${m}min`;
}

// -----------------------------------------------------------------------------
// ORDENS DE TRABALHO
// -----------------------------------------------------------------------------
export async function criarOT(params: {
  veiculo_id: string;
  cliente_id?: string | null;
  mecanico_id?: string | null;
  tipo_servico?: string;
  prioridade?: string;
  reclamacao?: string | null;
  km_entrada?: number | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("oficina_criar_ot", {
    p_veiculo_id: params.veiculo_id,
    p_cliente_id: params.cliente_id ?? null,
    p_mecanico_id: params.mecanico_id ?? null,
    p_tipo_servico: params.tipo_servico ?? "mecanica",
    p_prioridade: params.prioridade ?? "normal",
    p_reclamacao: params.reclamacao ?? null,
    p_km_entrada: params.km_entrada ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function atualizarStatusOT(otId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc("oficina_atualizar_status_ot", {
    p_ot_id: otId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function finalizarOT(params: {
  ot_id: string;
  servicos_executados?: string | null;
  gerar_fatura?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc("oficina_finalizar_ot", {
    p_ot_id: params.ot_id,
    p_servicos_executados: params.servicos_executados ?? null,
    p_gerar_fatura: params.gerar_fatura ?? true,
  });
  if (error) throw new Error(error.message);
}

export async function fetchOTs(status?: string, tipo?: string) {
  let query = supabase
    .from("oficina_ordens_trabalho")
    .select("*, veiculos(placa, modelo), clientes(nome), motoristas(nome), oficina_mecanicos(nome)")
    .order("created_at", { ascending: false })
    .limit(300);
  
  if (status && status !== "todos") query = query.eq("status", status);
  if (tipo && tipo !== "todos") query = query.eq("tipo_servico", tipo);
  
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as OficinaOT[];
}

export async function fetchOTDetalhe(otId: string) {
  const { data, error } = await supabase
    .from("oficina_ordens_trabalho")
    .select("*, veiculos(*), clientes(*), motoristas(*), oficina_mecanicos(nome)")
    .eq("id", otId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as OficinaOT | null;
}

// -----------------------------------------------------------------------------
// PEÇAS E SERVIÇOS DA OT
// -----------------------------------------------------------------------------
export async function adicionarPecaNaOT(params: {
  ot_id: string;
  produto_id: string;
  quantidade: number;
  valor_unitario: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("oficina_adicionar_peca", {
    p_ot_id: params.ot_id,
    p_produto_id: params.produto_id,
    p_quantidade: params.quantidade,
    p_valor_unitario: params.valor_unitario,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function adicionarServicoNaOT(params: {
  ot_id: string;
  mecanico_id: string;
  descricao: string;
  tempo_horas: number;
  valor_hora: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("oficina_adicionar_servico", {
    p_ot_id: params.ot_id,
    p_mecanico_id: params.mecanico_id,
    p_descricao: params.descricao,
    p_tempo_horas: params.tempo_horas,
    p_valor_hora: params.valor_hora,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchPecasDaOT(otId: string) {
  const { data, error } = await supabase
    .from("oficina_pecas_ot")
    .select("*, produtos(nome, unidade)")
    .eq("ot_id", otId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as OficinaPecaOT[];
}

export async function fetchServicosDaOT(otId: string) {
  const { data, error } = await supabase
    .from("oficina_servicos_ot")
    .select("*, oficina_mecanicos(nome)")
    .eq("ot_id", otId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as OficinaServicoOT[];
}

// -----------------------------------------------------------------------------
// MECÂNICOS
// -----------------------------------------------------------------------------
export async function fetchMecanicos(ativos = true) {
  let query = supabase
    .from("oficina_mecanicos")
    .select("*")
    .order("nome");
  
  if (ativos) query = query.eq("ativo", true);
  
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as OficinaMecanico[];
}

export async function criarMecanico(params: {
  nome: string;
  cpf?: string | null;
  especialidade?: string | null;
  telefone?: string | null;
  email?: string | null;
  valor_hora?: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from("oficina_mecanicos")
    .insert({
      nome: params.nome,
      cpf: params.cpf,
      especialidade: params.especialidade,
      telefone: params.telefone,
      email: params.email,
      valor_hora: params.valor_hora ?? 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

// -----------------------------------------------------------------------------
// ORÇAMENTOS
// -----------------------------------------------------------------------------
export async function fetchOrcamentos(status?: string) {
  let query = supabase
    .from("oficina_orcamentos")
    .select("*, clientes(nome), oficina_ordens_trabalho(numero)")
    .order("created_at", { ascending: false });
  
  if (status && status !== "todos") query = query.eq("status", status);
  
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as OficinaOrcamento[];
}

// -----------------------------------------------------------------------------
// GARANTIAS
// -----------------------------------------------------------------------------
export async function fetchGarantias(otId: string) {
  const { data, error } = await supabase
    .from("oficina_garantias")
    .select("*")
    .eq("ot_id", otId)
    .order("data_abertura", { ascending: false });
  if (error) throw new Error(error.message);
  return data as OficinaGarantia[];
}

// -----------------------------------------------------------------------------
// KPIs
// -----------------------------------------------------------------------------
export async function fetchKPIs(dataInicio?: string, dataFim?: string): Promise<OficinaKPIs> {
  const { data, error } = await supabase.rpc("oficina_kpis", {
    p_data_inicio: dataInicio ?? null,
    p_data_fim: dataFim ?? null,
  });
  if (error) throw new Error(error.message);
  return data as OficinaKPIs;
}

// -----------------------------------------------------------------------------
// OPÇÕES PARA SELECTS
// -----------------------------------------------------------------------------
export async function loadVeiculosAtivos() {
  const { data, error } = await supabase
    .from("veiculos")
    .select("id, placa, modelo, marca")
    .eq("status", "ativo")
    .order("placa");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadClientesAtivos() {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadProdutosAtivos() {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, unidade")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}