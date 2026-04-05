// =============================================================================
// MasterFleetBR - Tipos TypeScript para Módulo de Oficina
// =============================================================================

export type OficinaStatusOT = 'aberta' | 'em_diagnostico' | 'aguardando_aprovacao' | 'aprovada' | 'em_execucao' | 'em_testes' | 'finalizada' | 'cancelada';
export type OficinaTipoServico = 'mecanica' | 'eletrica' | 'funilaria' | 'pintura' | 'ar_condicionado' | 'suspensao' | 'freios' | 'motor' | 'transmissao' | 'diagnostico' | 'revisao' | 'outros';
export type OficinaPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type OficinaStatusOrcamento = 'pendente' | 'aprovado' | 'rejeitado' | 'parcial';
export type OficinaStatusGarantia = 'ativa' | 'expirada' | 'usada' | 'cancelada';

// -----------------------------------------------------------------------------
// Ordem de Trabalho (OT)
// -----------------------------------------------------------------------------
export interface OficinaOT {
  id: string;
  empresa_id: string;
  numero: number;
  veiculo_id: string | null;
  cliente_id: string | null;
  motorista_id: string | null;
  tipo_servico: OficinaTipoServico;
  prioridade: OficinaPrioridade;
  status: OficinaStatusOT;
  reclamacao_cliente: string | null;
  diagnostico_tecnico: string | null;
  servicos_executados: string | null;
  observacoes_gerais: string | null;
  km_entrada: number | null;
  nivel_combustivel_entrada: number | null;
  data_entrada: string;
  data_saida_prevista: string | null;
  data_saida_real: string | null;
  mecanico_responsavel_id: string | null;
  supervisor_id: string | null;
  valor_mao_de_obra: number;
  valor_pecas: number;
  valor_descontos: number;
  valor_total: number;
  garantia_dias: number;
  garantia_validade: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  veiculos: { placa: string | null; modelo: string | null } | null;
  clientes: { nome: string | null } | null;
  motoristas: { nome: string | null } | null;
  oficina_mecanicos: { nome: string | null } | null;
}

// -----------------------------------------------------------------------------
// Mecânico
// -----------------------------------------------------------------------------
export interface OficinaMecanico {
  id: string;
  empresa_id: string;
  nome: string;
  cpf: string | null;
  especialidade: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  valor_hora: number;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Serviço executado na OT
// -----------------------------------------------------------------------------
export interface OficinaServicoOT {
  id: string;
  empresa_id: string;
  ot_id: string;
  mecanico_id: string | null;
  descricao: string;
  tipo_servico: OficinaTipoServico | null;
  tempo_gasto_horas: number;
  valor_hora: number;
  valor_total: number;
  created_at: string;
  // Relations
  oficina_mecanicos: { nome: string | null } | null;
}

// -----------------------------------------------------------------------------
// Peça utilizada na OT
// -----------------------------------------------------------------------------
export interface OficinaPecaOT {
  id: string;
  empresa_id: string;
  ot_id: string;
  produto_id: string | null;
  nome_peca: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  origem: string;
  created_at: string;
  // Relations
  produtos: { nome: string | null; unidade: string | null } | null;
}

// -----------------------------------------------------------------------------
// Orçamento
// -----------------------------------------------------------------------------
export interface OficinaOrcamento {
  id: string;
  empresa_id: string;
  ot_id: string | null;
  cliente_id: string | null;
  numero: number;
  status: OficinaStatusOrcamento;
  descricao: string | null;
  validade: string | null;
  valor_mao_de_obra: number;
  valor_pecas: number;
  valor_total: number;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Garantia
// -----------------------------------------------------------------------------
export interface OficinaGarantia {
  id: string;
  empresa_id: string;
  ot_id: string;
  descricao_problema: string;
  solucao_aplicada: string | null;
  status: OficinaStatusGarantia;
  data_abertura: string;
  data_conclusao: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// KPIs
// -----------------------------------------------------------------------------
export interface OficinaKPIs {
  total_ot: number;
  ot_abertas: number;
  ot_finalizadas: number;
  faturamento_total: number;
  ticket_medio: number;
  tempo_medio_horas: number;
  por_tipo_servico: Array<{ tipo: string; count: number }>;
  top_mecanicos: Array<{ mecanico: string; ots: number }>;
}

// -----------------------------------------------------------------------------
// Helpers de UI
// -----------------------------------------------------------------------------
export const STATUS_OT_LABELS: Record<OficinaStatusOT, string> = {
  aberta: 'Aberta',
  em_diagnostico: 'Em Diagnóstico',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovada: 'Aprovada',
  em_execucao: 'Em Execução',
  em_testes: 'Em Testes',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};

export const STATUS_OT_COLORS: Record<OficinaStatusOT, string> = {
  aberta: 'bg-blue-50 text-blue-700 border-blue-200',
  em_diagnostico: 'bg-amber-50 text-amber-700 border-amber-200',
  aguardando_aprovacao: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  aprovada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  em_execucao: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  em_testes: 'bg-purple-50 text-purple-700 border-purple-200',
  finalizada: 'bg-green-50 text-green-700 border-green-200',
  cancelada: 'bg-gray-50 text-gray-700 border-gray-200',
};

export const PRIORIDADE_LABELS: Record<OficinaPrioridade, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const PRIORIDADE_COLORS: Record<OficinaPrioridade, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

export const TIPO_SERVICO_LABELS: Record<OficinaTipoServico, string> = {
  mecanica: 'Mecânica',
  eletrica: 'Elétrica',
  funilaria: 'Funilaria',
  pintura: 'Pintura',
  ar_condicionado: 'Ar-condicionado',
  suspensao: 'Suspensão',
  freios: 'Freios',
  motor: 'Motor',
  transmissao: 'Transmissão',
  diagnostico: 'Diagnóstico',
  revisao: 'Revisão',
  outros: 'Outros',
};