export type EscolarTurno = "manha" | "tarde" | "noite" | "integral";
export type EscolarPeriodoPresenca = "ida" | "volta";
export type EscolarStatusPresenca = "presente" | "falta" | "atraso" | "justificado";
export type EscolarStatusMensalidade = "aberta" | "paga" | "atrasada" | "cancelada";
export type EscolarTipoOcorrencia = "disciplina" | "saude" | "transporte" | "comunicado" | "outros";
export type EscolarSeveridadeOcorrencia = "baixa" | "media" | "alta";

export interface EscolarLinha {
  id: string;
  nome: string;
  turno: EscolarTurno;
  monitor_nome: string | null;
  capacidade: number;
  ativo: boolean;
}

export interface EscolarFamilia {
  id: string;
  nome_referencia: string;
  observacoes: string | null;
  ativo: boolean;
}

export interface EscolarResponsavel {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  parentesco: string | null;
  ativo: boolean;
}

export interface EscolarAluno {
  id: string;
  nome: string;
  data_nascimento: string | null;
  escola: string | null;
  serie: string | null;
  periodo: EscolarTurno;
  ativo: boolean;
  linha_id: string | null;
  familia_id: string | null;
  escolar_linhas?: { nome: string | null } | null;
  escolar_familias?: { nome_referencia: string | null } | null;
}

export interface EscolarPresenca {
  id: string;
  aluno_id: string;
  linha_id: string | null;
  data_referencia: string;
  periodo: EscolarPeriodoPresenca;
  status: EscolarStatusPresenca;
  observacao: string | null;
  escolar_alunos?: { nome: string | null } | null;
}

export interface EscolarMensalidade {
  id: string;
  aluno_id: string;
  referencia_mes: string;
  valor: number;
  desconto: number;
  multa: number;
  juros: number;
  valor_final: number;
  vencimento: string | null;
  pago_em: string | null;
  status: EscolarStatusMensalidade;
  escolar_alunos?: { nome: string | null } | null;
}

export interface EscolarOcorrencia {
  id: string;
  aluno_id: string;
  linha_id: string | null;
  tipo: EscolarTipoOcorrencia;
  severidade: EscolarSeveridadeOcorrencia;
  descricao: string;
  comunicado_responsavel: boolean;
  data_ocorrencia: string;
  resolvido_em: string | null;
  escolar_alunos?: { nome: string | null } | null;
}

export interface EscolarKPIs {
  linhas_ativas: number;
  alunos_ativos: number;
  presencas_hoje: number;
  mensalidades_abertas: number;
  mensalidades_atrasadas: number;
  ocorrencias_abertas: number;
}
