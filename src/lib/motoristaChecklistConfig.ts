export type ChecklistEtapa = "pre_partida" | "embarque" | "pos_servico";

export type MotoristaChecklistConfigItem = {
  etapa: ChecklistEtapa;
  item_codigo: string;
  item_label: string;
  ativo: boolean;
};

export const MOTORISTA_CHECKLIST_ITENS_PADRAO: Array<
  Omit<MotoristaChecklistConfigItem, "ativo">
> = [
  { etapa: "pre_partida", item_codigo: "documentos_ok", item_label: "Documentos conferidos" },
  { etapa: "pre_partida", item_codigo: "veiculo_inspecao", item_label: "Inspeção visual do veículo" },
  { etapa: "pre_partida", item_codigo: "itens_seguranca", item_label: "Itens de segurança validados" },
  { etapa: "embarque", item_codigo: "contagem_passageiros", item_label: "Contagem de passageiros feita" },
  { etapa: "embarque", item_codigo: "itinerario_alinhado", item_label: "Itinerário alinhado com operação" },
  { etapa: "embarque", item_codigo: "saida_registrada", item_label: "Saída registrada no app" },
  { etapa: "pos_servico", item_codigo: "desembarque_ok", item_label: "Desembarque concluído" },
  { etapa: "pos_servico", item_codigo: "vistoria_pos", item_label: "Vistoria pós-operação realizada" },
  { etapa: "pos_servico", item_codigo: "evidencias_finais", item_label: "Evidências finais anexadas" },
];

export const CHECKLIST_ETAPA_LABEL: Record<ChecklistEtapa, string> = {
  pre_partida: "Pré-partida",
  embarque: "Embarque",
  pos_servico: "Pós-serviço",
};
