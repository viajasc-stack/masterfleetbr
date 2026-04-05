// =============================================================================
// MasterFleetBR - Tipos TypeScript para Módulo de Manutenção
// =============================================================================

export type ManutencaoPrioridade = 'baixa' | 'media' | 'alta' | 'critica';
export type ManutencaoCategoria = 'motor' | 'freios' | 'suspensao' | 'direcao' | 'eletrica' | 'pneus' | 'carroceria' | 'ar_condicionado' | 'oleo_filtro' | 'transmissao' | 'escapamento' | 'outros';
export type SolicitacaoStatus = 'nova' | 'em_analise' | 'aprovada' | 'rejeitada' | 'convertida' | 'aguardando_info';
export type SolicitacaoOrigem = 'motorista' | 'admin' | 'checklist' | 'preventiva' | 'checklist_pre_viagem';
export type OrdemTipo = 'corretiva' | 'preventiva' | 'emergencial' | 'preditiva';
export type OrdemStatus = 'aberta' | 'triagem' | 'em_analise' | 'aguardando_pecas' | 'em_andamento' | 'pausada' | 'aguardando_terceiro' | 'finalizada' | 'cancelada';
export type PecaOrigem = 'estoque' | 'compra_direta';
export type PreventivaStatus = 'em_dia' | 'vencendo_proximo' | 'vencida' | 'concluida' | 'cancelada';
export type AlertaTipo = 'preventiva_vencida' | 'preventiva_vencendo' | 'custo_excedido' | 'veiculo_parado' | 'estoque_baixo' | 'os_atrasada' | 'garantia_vencendo' | 'nova_solicitacao';
export type AlertaSeveridade = 'baixa' | 'media' | 'alta' | 'critica';

// -----------------------------------------------------------------------------
// Solicitações
// -----------------------------------------------------------------------------
export interface ManutencaoSolicitacao {
  id: string;
  empresa_id: string;
  veiculo_id: string;
  motorista_id: string | null;
  categoria: ManutencaoCategoria | null;
  titulo: string;
  descricao: string;
  prioridade: ManutencaoPrioridade;
  status: SolicitacaoStatus;
  origem: SolicitacaoOrigem;
  km_atual: number | null;
  fotos: string[];
  rejeicao_motivo: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  veiculos: { placa: string | null; modelo: string | null; marca: string | null } | null;
  motoristas: { nome: string | null; cnh: string | null } | null;
}

// -----------------------------------------------------------------------------
// Ordens de Manutenção
// -----------------------------------------------------------------------------
export interface ManutencaoOrdem {
  id: string;
  empresa_id: string;
  solicitacao_id: string | null;
  veiculo_id: string;
  motorista_id: string | null;
  tipo: OrdemTipo;
  status: OrdemStatus;
  prioridade: ManutencaoPrioridade;
  categoria: ManutencaoCategoria | null;
  diagnostico: string | null;
  causa_raiz: string | null;
  solucao_aplicada: string | null;
  laudo_tecnico: string | null;
  fornecedor_id: string | null;
  oficina_interna: boolean;
  responsavel_tecnico: string | null;
  km_entrada: number | null;
  km_saida: number | null;
  data_entrada: string;
  data_saida_prevista: string | null;
  data_saida_real: string | null;
  data_conclusao: string | null;
  custo_pecas: number;
  custo_mao_de_obra: number;
  custo_terceiros: number;
  custo_total: number;
  fotos_antes: string[];
  fotos_depois: string[];
  anexos: Record<string, unknown>[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  veiculos: { placa: string | null; modelo: string | null; marca: string | null } | null;
  motoristas: { nome: string | null } | null;
  fornecedores: { nome: string | null } | null;
  manutencao_solicitacoes: { titulo: string | null; descricao: string | null } | null;
}

// -----------------------------------------------------------------------------
// Peças Aplicadas
// -----------------------------------------------------------------------------
export interface ManutencaoOrdemPeca {
  id: string;
  empresa_id: string;
  ordem_id: string;
  produto_id: string;
  local_estoque_id: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  origem: PecaOrigem;
  lote: string | null;
  created_at: string;
  // Relations
  produtos: { nome: string | null; unidade: string | null } | null;
  locais_estoque: { nome: string | null } | null;
}

// -----------------------------------------------------------------------------
// Serviços
// -----------------------------------------------------------------------------
export interface ManutencaoOrdemServico {
  id: string;
  empresa_id: string;
  ordem_id: string;
  tipo_servico_id: string | null;
  descricao: string | null;
  quantidade_horas: number;
  valor_hora: number;
  valor_total: number;
  mecanico_responsavel: string | null;
  created_at: string;
  // Relations
  tipos_servico: { nome: string | null } | null;
}

// -----------------------------------------------------------------------------
// Checklist
// -----------------------------------------------------------------------------
export interface ManutencaoChecklist {
  id: string;
  empresa_id: string;
  ordem_id: string;
  tipo: 'entrada' | 'saida';
  itens: Array<{ item: string; status: 'ok' | 'atencao' | 'problema'; obs?: string }>;
  observacoes_gerais: string | null;
  created_by: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Planos de Manutenção
// -----------------------------------------------------------------------------
export interface ManutencaoPlano {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  tipo_veiculo: string | null;
  intervalo_km: number | null;
  intervalo_dias: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManutencaoPlanoItem {
  id: string;
  empresa_id: string;
  plano_id: string;
  produto_id: string | null;
  tipo_servico_id: string | null;
  quantidade: number;
  observacao: string | null;
  created_at: string;
  // Relations
  produtos: { nome: string | null } | null;
  tipos_servico: { nome: string | null } | null;
}

// -----------------------------------------------------------------------------
// Veículo Planos (Preventivas por veículo)
// -----------------------------------------------------------------------------
export interface ManutencaoVeiculoPlano {
  id: string;
  empresa_id: string;
  veiculo_id: string;
  plano_id: string;
  ultima_execucao: string | null;
  proxima_execucao_km: number | null;
  proxima_execucao_data: string | null;
  status: PreventivaStatus;
  created_at: string;
  updated_at: string;
  // Relations
  veiculos: { placa: string | null; modelo: string | null } | null;
  manutencao_planos: { nome: string | null } | null;
}

// -----------------------------------------------------------------------------
// Alertas
// -----------------------------------------------------------------------------
export interface ManutencaoAlerta {
  id: string;
  empresa_id: string;
  veiculo_id: string | null;
  ordem_id: string | null;
  veiculo_plano_id: string | null;
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  titulo: string;
  mensagem: string | null;
  lido: boolean;
  lido_em: string | null;
  created_at: string;
  // Relations
  veiculos: { placa: string | null; modelo: string | null } | null;
}

// -----------------------------------------------------------------------------
// KPIs
// -----------------------------------------------------------------------------
export interface ManutencaoKPIs {
  total_os: number;
  os_abertas: number;
  os_em_andamento: number;
  os_aguardando_pecas: number;
  os_finalizadas: number;
  solicitacoes_novas: number;
  custo_total_periodo: number;
  custo_medio_por_os: number;
  preventivas_vencidas: number;
  alertas_nao_lidos: number;
  top_veiculos_custos: Array<{ veiculo_id: string; placa: string; modelo: string; total: number }>;
  custo_por_categoria: Array<{ categoria: string; total: number; count: number }>;
}

// -----------------------------------------------------------------------------
// Histórico por Veículo
// -----------------------------------------------------------------------------
export interface ManutencaoHistoricoVeiculo {
  veiculo_id: string;
  placa: string | null;
  modelo: string | null;
  marca: string | null;
  total_os: number;
  os_finalizadas: number;
  os_em_aberto: number;
  custo_total: number;
  custo_medio: number;
  ultima_manutencao: string | null;
  ultima_saida: string | null;
  total_preventivas: number;
  total_corretivas: number;
}

// -----------------------------------------------------------------------------
// Helpers de UI
// -----------------------------------------------------------------------------
export const STATUS_LABELS: Record<OrdemStatus, string> = {
  aberta: 'Aberta',
  triagem: 'Em Triagem',
  em_analise: 'Em Análise',
  aguardando_pecas: 'Aguardando Peças',
  em_andamento: 'Em Andamento',
  pausada: 'Pausada',
  aguardando_terceiro: 'Aguardando Terceiro',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

export const STATUS_COLORS: Record<OrdemStatus, string> = {
  aberta: 'bg-blue-50 text-blue-700 border-blue-200',
  triagem: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  em_analise: 'bg-amber-50 text-amber-700 border-amber-200',
  aguardando_pecas: 'bg-orange-50 text-orange-700 border-orange-200',
  em_andamento: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pausada: 'bg-slate-50 text-slate-700 border-slate-200',
  aguardando_terceiro: 'bg-purple-50 text-purple-700 border-purple-200',
  finalizada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelada: 'bg-gray-50 text-gray-700 border-gray-200',
};

export const PRIORIDADE_LABELS: Record<ManutencaoPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORIDADE_COLORS: Record<ManutencaoPrioridade, string> = {
  baixa: 'bg-slate-100 text-slate-700',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700',
};

export const CATEGORIA_LABELS: Record<ManutencaoCategoria, string> = {
  motor: 'Motor',
  freios: 'Freios',
  suspensao: 'Suspensão/Direção',
  direcao: 'Direção',
  eletrica: 'Elétrica',
  pneus: 'Pneus',
  carroceria: 'Carroceria',
  ar_condicionado: 'Ar-condicionado',
  oleo_filtro: 'Óleo e Filtros',
  transmissao: 'Transmissão',
  escapamento: 'Escapamento',
  outros: 'Outros',
};

export const SOLICITACAO_STATUS_LABELS: Record<SolicitacaoStatus, string> = {
  nova: 'Nova',
  em_analise: 'Em Análise',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  convertida: 'Convertida',
  aguardando_info: 'Aguardando Info',
};

export const SOLICITACAO_STATUS_COLORS: Record<SolicitacaoStatus, string> = {
  nova: 'bg-blue-50 text-blue-700 border-blue-200',
  em_analise: 'bg-amber-50 text-amber-700 border-amber-200',
  aprovada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejeitada: 'bg-red-50 text-red-700 border-red-200',
  convertida: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  aguardando_info: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

export const PREVENTIVA_STATUS_LABELS: Record<PreventivaStatus, string> = {
  em_dia: 'Em dia',
  vencendo_proximo: 'Vencendo',
  vencida: 'Vencida',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const PREVENTIVA_STATUS_COLORS: Record<PreventivaStatus, string> = {
  em_dia: 'bg-emerald-50 text-emerald-700',
  vencendo_proximo: 'bg-amber-50 text-amber-700',
  vencida: 'bg-red-50 text-red-700',
  concluida: 'bg-blue-50 text-blue-700',
  cancelada: 'bg-gray-50 text-gray-700',
};