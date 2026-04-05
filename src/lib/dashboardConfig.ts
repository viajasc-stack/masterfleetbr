export type DashboardConfig = {
  marcador_combustivel_topo: boolean;
  widget_financeiro_resumo: boolean;
  widget_manutencao_resumo: boolean;
  alertas_topo: boolean;
  kpis_gerais: boolean;
  grafico_distribuicao_operacional: boolean;
  grafico_top_motoristas: boolean;
  radar_risco_operacional: boolean;
  eventos_severidade: boolean;
  semaforo_operacional: boolean;
  cards_alertas_operacionais: boolean;
  alertas_desvio_rota: boolean;
  mapa_operacional: boolean;
  timeline_eventos: boolean;
  os_em_aberto: boolean;
  atalhos_rapidos: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export const DASHBOARD_CONFIG_DEFAULTS: DashboardConfig = {
  marcador_combustivel_topo: true,
  widget_financeiro_resumo: false,
  widget_manutencao_resumo: false,
  alertas_topo: true,
  kpis_gerais: true,
  grafico_distribuicao_operacional: true,
  grafico_top_motoristas: true,
  radar_risco_operacional: true,
  eventos_severidade: true,
  semaforo_operacional: true,
  cards_alertas_operacionais: true,
  alertas_desvio_rota: true,
  mapa_operacional: true,
  timeline_eventos: true,
  os_em_aberto: true,
  atalhos_rapidos: true,
};

export const DASHBOARD_CONFIG_LABELS: Array<{ key: keyof DashboardConfig; label: string; description: string }> = [
  {
    key: "marcador_combustivel_topo",
    label: "Marcador de combustível no topo",
    description: "Mostra os tanques de combustível no início do dashboard.",
  },
  {
    key: "widget_financeiro_resumo",
    label: "Widget financeiro (contas do dia)",
    description: "Exibe contas a pagar e a receber com vencimento na data atual.",
  },
  {
    key: "widget_manutencao_resumo",
    label: "Widget manutenção (triagem e preventivas)",
    description: "Exibe novas solicitações e veículos próximos/em atraso em planos preventivos.",
  },
  {
    key: "alertas_topo",
    label: "Alertas de topo",
    description: "Exibe a faixa de alertas logo após o cabeçalho.",
  },
  {
    key: "kpis_gerais",
    label: "KPIs gerais",
    description: "Cards de OS, clientes, veículos, motoristas e contratos.",
  },
  {
    key: "grafico_distribuicao_operacional",
    label: "Gráfico de distribuição operacional",
    description: "Donut com pendentes, em andamento e concluídas hoje.",
  },
  {
    key: "grafico_top_motoristas",
    label: "Top motoristas em execução",
    description: "Gráfico de barras por motorista.",
  },
  {
    key: "radar_risco_operacional",
    label: "Radar de risco operacional",
    description: "Resumo visual de atrasos, desvio e inconsistências.",
  },
  {
    key: "eventos_severidade",
    label: "Eventos por severidade",
    description: "Cards de info, warning e crítico.",
  },
  {
    key: "semaforo_operacional",
    label: "Semáforo operacional",
    description: "Bloco com status e operação por motorista.",
  },
  {
    key: "cards_alertas_operacionais",
    label: "Cards de alertas operacionais",
    description: "Atraso de início, finalização, KM divergente e desvio 24h.",
  },
  {
    key: "alertas_desvio_rota",
    label: "Lista de alertas de desvio de rota",
    description: "Tabela com os últimos eventos de desvio.",
  },
  {
    key: "mapa_operacional",
    label: "Mapa operacional",
    description: "Mapa simplificado com última posição de motoristas.",
  },
  {
    key: "timeline_eventos",
    label: "Timeline de eventos",
    description: "Auditoria dos eventos de OS.",
  },
  {
    key: "os_em_aberto",
    label: "OS em aberto",
    description: "Lista das ordens de serviço abertas.",
  },
  {
    key: "atalhos_rapidos",
    label: "Atalhos rápidos",
    description: "Cards de ações rápidas de cadastro/operação.",
  },
];

export function mergeDashboardConfig(raw: unknown): DashboardConfig {
  const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...DASHBOARD_CONFIG_DEFAULTS,
    ...Object.fromEntries(
      Object.keys(DASHBOARD_CONFIG_DEFAULTS).map((key) => [
        key,
        typeof parsed[key] === "boolean"
          ? Boolean(parsed[key])
          : DASHBOARD_CONFIG_DEFAULTS[key as keyof DashboardConfig],
      ])
    ),
  } as DashboardConfig;
}

export function getDashboardConfigStorageKey(empresaId: string) {
  return `mfbr:dashboard_config:${empresaId}`;
}

export function readDashboardConfigLocal(empresaId: string): DashboardConfig | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(getDashboardConfigStorageKey(empresaId));
    if (!raw) return null;
    return mergeDashboardConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeDashboardConfigLocal(empresaId: string, config: DashboardConfig) {
  if (!isBrowser()) return;
  window.localStorage.setItem(getDashboardConfigStorageKey(empresaId), JSON.stringify(config));
}
