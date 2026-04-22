import { supabase } from "@/lib/supabase/client";

type BillingAccessPayload = {
  status: string | null;
  billing_model?: string | null;
  modulos_ativos?: unknown;
};

const BASE_MODULES = ["operacional"];

const ROUTE_MODULE_MAP: Array<{ prefix: string; modulo: string }> = [
  { prefix: "/ordens-servico", modulo: "operacional" },
  { prefix: "/orcamentos", modulo: "operacional" },
  { prefix: "/contratos", modulo: "operacional" },
  { prefix: "/passageiros", modulo: "passageiros" },
  { prefix: "/clientes", modulo: "operacional" },
  { prefix: "/veiculos", modulo: "operacional" },
  { prefix: "/abastecimentos", modulo: "operacional" },
  { prefix: "/motoristas", modulo: "operacional" },
  { prefix: "/usuarios", modulo: "operacional" },
  { prefix: "/inventario", modulo: "inventario" },
  { prefix: "/financeiro", modulo: "financeiro" },
  { prefix: "/manutencao", modulo: "manutencao" },
  { prefix: "/oficina", modulo: "oficina" },
  { prefix: "/relatorios", modulo: "operacional" },
  { prefix: "/telemetria", modulo: "operacional" },
  { prefix: "/observabilidade", modulo: "operacional" },
  { prefix: "/portal-cliente", modulo: "operacional" },
  { prefix: "/escalas", modulo: "operacional" },
  { prefix: "/agenda", modulo: "agenda" },
  { prefix: "/viagens", modulo: "viagens" },
  { prefix: "/masteria", modulo: "operacional" },
  { prefix: "/escolar", modulo: "escolar" },
  { prefix: "/central-negocios", modulo: "operacional" },
  { prefix: "/aniversariantes", modulo: "operacional" },
  { prefix: "/suporte", modulo: "operacional" },
  { prefix: "/configuracoes", modulo: "operacional" },
  { prefix: "/dashboard", modulo: "operacional" },
];

function parseModulos(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  return [];
}

export function getRequiredModuleForPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const rule = ROUTE_MODULE_MAP.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return rule?.modulo ?? null;
}

export async function loadEmpresaModuleAccess() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    return {
      assinaturaStatus: null as string | null,
      empresaId: null as string | null,
      canUseAllModules: false,
      allowedModules: [] as string[],
      globalActiveModules: [] as string[],
    };
  }

  const { data: globalModulesData } = await supabase.rpc("get_modulos_globais_ativos");
  const globalActiveModulesRaw = Array.isArray(globalModulesData)
    ? globalModulesData.map((m) => String(m))
    : [];

  // Fallback de rollout: garante visibilidade do módulo Escolar no menu
  // mesmo antes da ativação global refletir no banco em todos os ambientes.
  const globalActiveModules = globalActiveModulesRaw.includes("escolar")
    ? globalActiveModulesRaw
    : [...globalActiveModulesRaw, "escolar"];

  function applyGlobalFilter(modules: string[]) {
    if (globalActiveModules.length === 0) return modules;
    return modules.filter((m) => globalActiveModules.includes(m));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const empresaId = profile?.empresa_id ?? null;
  if (!empresaId) {
    return {
      assinaturaStatus: null as string | null,
      empresaId,
      canUseAllModules: true,
      allowedModules: applyGlobalFilter(BASE_MODULES),
      globalActiveModules,
    };
  }

  const { data: billingData } = await supabase.rpc("get_billing_current");
  const billing = (billingData ?? null) as BillingAccessPayload | null;
  const status = billing?.status ?? null;
  const modulosEmpresa = parseModulos(billing?.modulos_ativos);

  const allowedModules = applyGlobalFilter(Array.from(new Set([...BASE_MODULES, ...modulosEmpresa])));

  return {
    assinaturaStatus: status,
    empresaId,
    canUseAllModules: status === "trial",
    allowedModules,
    globalActiveModules,
  };
}
