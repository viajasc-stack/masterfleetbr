// =============================================================================
// MasterFleetBR - Lib de Manutenção (Funções + Helpers)
// =============================================================================
import { supabase } from "@/lib/supabase/client";
import type {
  ManutencaoSolicitacao,
  ManutencaoOrdem,
  ManutencaoOrdemPeca,
  ManutencaoOrdemServico,
  ManutencaoPlano,
  ManutencaoVeiculoPlano,
  ManutencaoAlerta,
  ManutencaoKPIs,
} from "@/types/manutencao.types";

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

export function diasAte(data: string | null | undefined): number | null {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data);
  alvo.setHours(0, 0, 0, 0);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

// -----------------------------------------------------------------------------
// SOLICITAÇÕES
// -----------------------------------------------------------------------------
export async function criarSolicitacao(params: {
  veiculo_id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  prioridade?: string;
  origem?: string;
  km_atual?: number | null;
  fotos?: string[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("manutencao_criar_solicitacao", {
    p_veiculo_id: params.veiculo_id,
    p_categoria: params.categoria,
    p_titulo: params.titulo,
    p_descricao: params.descricao,
    p_prioridade: params.prioridade ?? "media",
    p_origem: params.origem ?? "motorista",
    p_km_atual: params.km_atual ?? null,
    p_fotos: params.fotos ?? [],
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function aprovarSolicitacao(solicitacaoId: string, tipoOs = "corretiva", prioridade = "media"): Promise<string> {
  const { data, error } = await supabase.rpc("manutencao_aprovar_solicitacao", {
    p_solicitacao_id: solicitacaoId,
    p_tipo_os: tipoOs,
    p_prioridade: prioridade,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function rejeitarSolicitacao(solicitacaoId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("manutencao_rejeitar_solicitacao", {
    p_solicitacao_id: solicitacaoId,
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message);
}

export async function atualizarStatusSolicitacao(solicitacaoId: string, status: string): Promise<void> {
  const { error } = await supabase.rpc("manutencao_atualizar_status_solicitacao", {
    p_solicitacao_id: solicitacaoId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

export async function fetchSolicitacoes(status?: string) {
  let query = supabase
    .from("manutencao_solicitacoes")
    .select("*, veiculos(placa, modelo, marca), motoristas(nome, cnh)")
    .order("created_at", { ascending: false })
    .limit(200);
  
  if (status && status !== "todos") {
    query = query.eq("status", status);
  }
  
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as ManutencaoSolicitacao[];
}

// -----------------------------------------------------------------------------
// ORDENS DE MANUTENÇÃO
// -----------------------------------------------------------------------------
export async function fetchOrdens(status?: string, tipo?: string) {
  let query = supabase
    .from("manutencao_ordens")
    .select("*, veiculos(placa, modelo, marca), motoristas(nome), fornecedores(nome), manutencao_solicitacoes(titulo, descricao)")
    .order("created_at", { ascending: false })
    .limit(300);
  
  if (status && status !== "todos") query = query.eq("status", status);
  if (tipo && tipo !== "todos") query = query.eq("tipo", tipo);
  
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as ManutencaoOrdem[];
}

export async function fetchOrdemDetalhe(ordemId: string) {
  const { data, error } = await supabase
    .from("manutencao_ordens")
    .select("*, veiculos(*), motoristas(nome, cnh, telefone), fornecedores(nome, telefone)")
    .eq("id", ordemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ManutencaoOrdem | null;
}

export async function adicionarPecaNaOrdem(params: {
  ordem_id: string;
  produto_id: string;
  local_estoque_id?: string | null;
  quantidade: number;
  valor_unitario: number;
  origem?: string;
  lote?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("manutencao_adicionar_peca", {
    p_ordem_id: params.ordem_id,
    p_produto_id: params.produto_id,
    p_local_estoque_id: params.local_estoque_id ?? null,
    p_quantidade: params.quantidade,
    p_valor_unitario: params.valor_unitario,
    p_origem: params.origem ?? "estoque",
    p_lote: params.lote ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function adicionarServicoNaOrdem(params: {
  ordem_id: string;
  tipo_servico_id?: string | null;
  descricao?: string | null;
  quantidade_horas?: number;
  valor_hora?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("manutencao_adicionar_servico", {
    p_ordem_id: params.ordem_id,
    p_tipo_servico_id: params.tipo_servico_id ?? null,
    p_descricao: params.descricao ?? null,
    p_quantidade_horas: params.quantidade_horas ?? 0,
    p_valor_hora: params.valor_hora ?? 0,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function finalizarOrdem(params: {
  ordem_id: string;
  data_conclusao?: string;
  solucao_aplicada?: string | null;
  km_saida?: number | null;
}): Promise<void> {
  const { error } = await supabase.rpc("manutencao_finalizar_ordem", {
    p_ordem_id: params.ordem_id,
    p_data_conclusao: params.data_conclusao ?? new Date().toISOString(),
    p_gerar_conta_pagar: false,
    p_solucao_aplicada: params.solucao_aplicada ?? null,
    p_km_saida: params.km_saida ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function fetchPecasDaOrdem(ordemId: string) {
  const { data, error } = await supabase
    .from("manutencao_ordens_pecas")
    .select("*, produtos(nome, unidade), locais_estoque(nome)")
    .eq("ordem_id", ordemId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as ManutencaoOrdemPeca[];
}

export async function fetchServicosDaOrdem(ordemId: string) {
  const { data, error } = await supabase
    .from("manutencao_ordens_servicos")
    .select("*, tipos_servico(nome)")
    .eq("ordem_id", ordemId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as ManutencaoOrdemServico[];
}

// -----------------------------------------------------------------------------
// PLANOS E PREVENTIVAS
// -----------------------------------------------------------------------------
export async function fetchPlanos() {
  const { data, error } = await supabase
    .from("manutencao_planos")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data as ManutencaoPlano[];
}

export async function fetchVeiculoPlanos() {
  const { data, error } = await supabase
    .from("manutencao_veiculo_planos")
    .select("*, veiculos(placa, modelo), manutencao_planos(nome)")
    .order("proxima_execucao_data", { ascending: true });
  if (error) throw new Error(error.message);
  return data as ManutencaoVeiculoPlano[];
}

export async function processarPreventivas(): Promise<number> {
  const { data, error } = await supabase.rpc("manutencao_processar_preventivas");
  if (error) throw new Error(error.message);
  return data as number;
}

// -----------------------------------------------------------------------------
// ALERTAS
// -----------------------------------------------------------------------------
export async function fetchAlertasNaoLidos() {
  const { data, error } = await supabase
    .from("manutencao_alertas")
    .select("*, veiculos(placa, modelo)")
    .eq("lido", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as ManutencaoAlerta[];
}

export async function marcarAlertaLido(alertaId: string): Promise<void> {
  const { error } = await supabase.rpc("manutencao_marcar_alerta_lido", { p_alerta_id: alertaId });
  if (error) throw new Error(error.message);
}

export async function marcarTodosAlertasLidos(): Promise<void> {
  const { error } = await supabase.rpc("manutencao_marcar_todos_alertas_lidos");
  if (error) throw new Error(error.message);
}

export async function gerarAlertas(): Promise<number> {
  const { data, error } = await supabase.rpc("manutencao_gerar_alertas");
  if (error) throw new Error(error.message);
  return data as number;
}

// -----------------------------------------------------------------------------
// KPIs
// -----------------------------------------------------------------------------
export async function fetchKPIs(dataInicio?: string, dataFim?: string): Promise<ManutencaoKPIs> {
  const { data, error } = await supabase.rpc("manutencao_kpis", {
    p_data_inicio: dataInicio ?? null,
    p_data_fim: dataFim ?? null,
  });
  if (error) throw new Error(error.message);
  return data as ManutencaoKPIs;
}

// -----------------------------------------------------------------------------
// OPCOES PARA SELECTS
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

export async function loadMotoristasAtivos() {
  const { data, error } = await supabase
    .from("motoristas")
    .select("id, nome, cnh")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadFornecedoresAtivos(tipo?: string) {
  let query = supabase.from("fornecedores").select("id, nome, tipos").eq("ativo", true).order("nome");
  if (tipo) query = query.contains("tipos", [tipo]);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadTiposServico() {
  const { data, error } = await supabase
    .from("manutencao_tipos_servico")
    .select("id, nome, categoria, valor_hora")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadProdutosAtivos() {
  const { data, error } = await supabase
    .from("produtos")
    .select("id, nome, unidade, estoque_minimo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadLocaisEstoque() {
  const { data, error } = await supabase
    .from("locais_estoque")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// -----------------------------------------------------------------------------
// UPLOAD DE FOTOS
// -----------------------------------------------------------------------------
export async function uploadFotoManutencao(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("manutencao-fotos")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  
  const { data: urlData } = supabase.storage
    .from("manutencao-fotos")
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
}