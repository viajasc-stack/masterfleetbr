import { supabase } from "@/lib/supabase/client";

type AssinaturaComPlano = {
  status: string | null;
  planos:
    | {
        modulos?: unknown;
      }
    | Array<{ modulos?: unknown }>
    | null;
};

const BASE_MODULES = ["dashboard", "configuracoes", "usuarios", "suporte"];

const ROUTE_MODULE_MAP: Array<{ prefix: string; modulo: string }> = [
  { prefix: "/ordens-servico", modulo: "ordens_servico" },
  { prefix: "/orcamentos", modulo: "ordens_servico" },
  { prefix: "/contratos", modulo: "ordens_servico" },
  { prefix: "/clientes", modulo: "clientes" },
  { prefix: "/veiculos", modulo: "veiculos" },
  { prefix: "/abastecimentos", modulo: "ordens_servico" },
  { prefix: "/motoristas", modulo: "motoristas" },
  { prefix: "/usuarios", modulo: "usuarios" },
  { prefix: "/inventario", modulo: "inventario" },
  { prefix: "/financeiro", modulo: "financeiro" },
  { prefix: "/manutencao", modulo: "manutencao" },
  { prefix: "/relatorios", modulo: "relatorios" },
  { prefix: "/agenda", modulo: "agenda" },
  { prefix: "/aniversariantes", modulo: "relatorios" },
  { prefix: "/suporte", modulo: "suporte" },
  { prefix: "/configuracoes", modulo: "configuracoes" },
  { prefix: "/dashboard", modulo: "dashboard" },
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
    };
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
      allowedModules: BASE_MODULES,
    };
  }

  const { data: assinaturaData } = await supabase
    .from("assinaturas")
    .select("status, planos(modulos)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assinatura = (assinaturaData ?? null) as AssinaturaComPlano | null;
  const status = assinatura?.status ?? null;
  const plano = Array.isArray(assinatura?.planos) ? assinatura?.planos[0] : assinatura?.planos;
  const modulosPlano = parseModulos(plano?.modulos);

  const allowedModules = Array.from(new Set([...BASE_MODULES, ...modulosPlano]));

  return {
    assinaturaStatus: status,
    empresaId,
    canUseAllModules: status === "trial",
    allowedModules,
  };
}
