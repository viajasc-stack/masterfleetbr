"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { supabase } from "@/lib/supabase/client";

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
  empresaNome?: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: string;
  modulo: string;
};

const GROUPS = ["Operacional", "Gestão", "Administrativo"];

const INVENTARIO_SUBLINKS = [
  { href: "/inventario", label: "Dashboard" },
  { href: "/inventario/itens", label: "Itens de Estoque" },
  { href: "/inventario/categorias", label: "Categorias" },
  { href: "/inventario/movimentacoes", label: "Movimentações" },
  { href: "/inventario/entradas", label: "Entradas" },
  { href: "/inventario/saidas", label: "Saídas" },
  { href: "/inventario/compras", label: "Compras" },
  { href: "/inventario/fornecedores", label: "Fornecedores" },
  { href: "/inventario/locais-estoque", label: "Locais de Estoque" },
  { href: "/inventario/ajustes-estoque", label: "Ajustes de Estoque" },
  { href: "/inventario/alertas-reposicao", label: "Alertas e Reposição" },
  { href: "/inventario/configuracoes", label: "Configurações" },
];

const FINANCEIRO_SUBLINKS = [
  { href: "/financeiro", label: "Dashboard" },
  { href: "/financeiro/contas", label: "Todas as contas" },
  { href: "/financeiro/contas?tipo=pagar", label: "Contas a pagar" },
  { href: "/financeiro/contas?tipo=receber", label: "Contas a receber" },
];

const MANUTENCAO_SUBLINKS = [
  { href: "/manutencao", label: "Dashboard" },
  { href: "/manutencao/solicitacoes", label: "Solicitações" },
  { href: "/manutencao/preventivas", label: "Preventivas" },
  { href: "/manutencao/planos", label: "Planos" },
];

const OFICINA_SUBLINKS = [
  { href: "/oficina", label: "Dashboard" },
  { href: "/oficina/ordens", label: "Ordens de Trabalho" },
  { href: "/oficina/mecanicos", label: "Mecânicos" },
  { href: "/oficina/orcamentos", label: "Orçamentos" },
  { href: "/oficina/kpis", label: "Indicadores" },
];

const ESCOLAR_SUBLINKS = [
  { href: "/escolar", label: "Dashboard" },
  { href: "/escolar/linhas", label: "Linhas" },
  { href: "/escolar/alunos", label: "Alunos" },
  { href: "/escolar/responsaveis", label: "Responsáveis" },
  { href: "/escolar/familias", label: "Famílias" },
  { href: "/escolar/presenca", label: "Presença" },
  { href: "/escolar/mensalidades", label: "Mensalidades" },
  { href: "/escolar/ocorrencias", label: "Ocorrências" },
];

const FRETAMENTOS_SUBLINKS = [
  { href: "/fretamentos/eventual", label: "Eventual" },
  { href: "/fretamentos/recorrente", label: "Recorrente" },
];

const CONFIGURACOES_SUBLINKS = [
  { href: "/configuracoes", label: "Geral" },
  { href: "/configuracoes/meu-plano", label: "Meu plano" },
  { href: "/configuracoes/dashboard", label: "Dashboard" },
  { href: "/configuracoes/fretamento-recorrente", label: "Fretamento recorrente" },
];

const RELATORIOS_SUBLINKS = [
  { href: "/relatorios", label: "Visão geral" },
  { href: "/relatorios/ordens-servico", label: "Ordens de Serviço" },
];

const LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", group: "Operacional", modulo: "operacional" },
  { href: "/ordens-servico", label: "Ordens de Serviço", icon: "🧾", group: "Operacional", modulo: "operacional" },
  { href: "/veiculos", label: "Veículos", icon: "🚚", group: "Operacional", modulo: "operacional" },
  { href: "/motoristas", label: "Motoristas", icon: "🧑‍✈️", group: "Operacional", modulo: "operacional" },
  { href: "/fretamentos", label: "Fretamentos", icon: "🚌", group: "Operacional", modulo: "operacional" },
  { href: "/contratos", label: "Contratos", icon: "📑", group: "Operacional", modulo: "operacional" },
  { href: "/passageiros", label: "Passageiros", icon: "👥", group: "Operacional", modulo: "passageiros" },
  { href: "/clientes", label: "Clientes", icon: "🤝", group: "Operacional", modulo: "operacional" },
  { href: "/inventario", label: "Estoque", icon: "📦", group: "Gestão", modulo: "inventario" },
  { href: "/financeiro", label: "Financeiro", icon: "💰", group: "Gestão", modulo: "financeiro" },
  { href: "/manutencao", label: "Manutenção", icon: "🛠️", group: "Gestão", modulo: "manutencao" },
  { href: "/oficina", label: "Oficina", icon: "🔧", group: "Gestão", modulo: "oficina" },
  { href: "/escolar", label: "Escolar", icon: "🎓", group: "Gestão", modulo: "escolar" },
  { href: "/abastecimentos", label: "Abastecimentos", icon: "⛽", group: "Gestão", modulo: "operacional" },
  { href: "/orcamentos", label: "Orçamentos", icon: "📝", group: "Gestão", modulo: "operacional" },
  { href: "/agenda", label: "Agenda", icon: "📅", group: "Gestão", modulo: "agenda" },
  { href: "/viagens", label: "Viagens", icon: "🧭", group: "Gestão", modulo: "viagens" },
  { href: "/central-negocios", label: "Central de Negócios", icon: "🏢", group: "Gestão", modulo: "operacional" },
  { href: "/masteria", label: "MasterIA", icon: "🤖", group: "Gestão", modulo: "operacional" },
  { href: "/relatorios", label: "Relatórios", icon: "📈", group: "Gestão", modulo: "operacional" },
  { href: "/suporte", label: "Suporte", icon: "🛟", group: "Administrativo", modulo: "operacional" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️", group: "Administrativo", modulo: "operacional" },
];

export default function Sidebar({ mobileOpen = false, onClose, empresaNome }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inventarioOpenManual, setInventarioOpenManual] = useState<boolean | null>(null);
  const [financeiroOpenManual, setFinanceiroOpenManual] = useState<boolean | null>(null);
  const [manutencaoOpenManual, setManutencaoOpenManual] = useState<boolean | null>(null);
  const [oficinaOpenManual, setOficinaOpenManual] = useState<boolean | null>(null);
  const [escolarOpenManual, setEscolarOpenManual] = useState<boolean | null>(null);
  const [fretamentosOpenManual, setFretamentosOpenManual] = useState<boolean | null>(null);
  const [configuracoesOpenManual, setConfiguracoesOpenManual] = useState<boolean | null>(null);
  const [relatoriosOpenManual, setRelatoriosOpenManual] = useState<boolean | null>(null);
  const [canUseAllModules, setCanUseAllModules] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [globalActiveModules, setGlobalActiveModules] = useState<string[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [canShowReferralMenu, setCanShowReferralMenu] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [billingRestricted, setBillingRestricted] = useState(false);

  useEffect(() => {
    async function loadModules() {
      const access = await loadEmpresaModuleAccess();
      setCanUseAllModules(access.canUseAllModules);
      setAllowedModules(access.allowedModules);
      setGlobalActiveModules(access.globalActiveModules ?? []);
    }
    void loadModules();
  }, []);

  useEffect(() => {
    async function loadSupportUnread() {
      const { data } = await supabase.rpc("support_unread_count");
      setSupportUnread(Number(data ?? 0));
    }
    const t = setTimeout(() => {
      void loadSupportUnread();
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    async function loadReferralMenuVisibility() {
      const { data } = await supabase.rpc("get_billing_current");
      setCanShowReferralMenu((data?.status ?? "") === "ativa");
      const status = String(data?.status ?? "").toLowerCase();
      setBillingRestricted(status === "bloqueada");
    }
    const t = setTimeout(() => {
      void loadReferralMenuVisibility();
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    async function loadBrandingLogo() {
      const { data } = await supabase.rpc("get_public_branding");
      const branding = (data ?? null) as { logo_url?: string | null } | null;
      setLogoUrl(branding?.logo_url ?? null);
    }

    const t = setTimeout(() => {
      void loadBrandingLogo();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const inventarioOpen = inventarioOpenManual ?? Boolean(pathname?.startsWith("/inventario"));
  const financeiroOpen = financeiroOpenManual ?? Boolean(pathname?.startsWith("/financeiro"));
  const manutencaoOpen = manutencaoOpenManual ?? Boolean(pathname?.startsWith("/manutencao"));
  const oficinaOpen = oficinaOpenManual ?? Boolean(pathname?.startsWith("/oficina"));
  const escolarOpen = escolarOpenManual ?? Boolean(pathname?.startsWith("/escolar"));
  const fretamentosOpen = fretamentosOpenManual ?? Boolean(pathname?.startsWith("/fretamentos"));
  const configuracoesOpen = configuracoesOpenManual ?? Boolean(pathname?.startsWith("/configuracoes"));
  const relatoriosOpen = relatoriosOpenManual ?? Boolean(pathname?.startsWith("/relatorios"));

  function isAtivo(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(href + "/");
  }

  function hasModulo(modulo: string) {
    if (globalActiveModules.length > 0 && !globalActiveModules.includes(modulo)) return false;
    if (canUseAllModules) return true;
    return allowedModules.includes(modulo);
  }

  function parentItemClass(ativo: boolean) {
    return `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-all ${
      ativo
        ? "bg-gradient-to-r from-indigo-500/20 to-cyan-500/10 text-white border-indigo-400/30 shadow-sm shadow-indigo-900/20"
        : "text-slate-300 border-transparent hover:bg-slate-800/70 hover:text-white hover:border-slate-700"
    }`;
  }

  function subItemClass(ativo: boolean) {
    return `block px-3 py-1.5 rounded-lg text-sm border transition-all ${
      ativo
        ? "bg-slate-800 text-white border-slate-700"
        : "text-slate-400 border-transparent hover:bg-slate-800/60 hover:text-slate-100"
    }`;
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 xl:hidden"
          onClick={onClose}
          aria-label="Fechar menu"
        />
      ) : null}

      <aside
        className={`fixed xl:static inset-y-0 left-0 z-40 w-72 xl:w-64 border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-xl flex flex-col shrink-0 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        }`}
      >
      <div className="p-4 border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-xl text-white text-xs font-bold flex items-center justify-center overflow-hidden ${
                logoUrl
                  ? "bg-white border border-slate-200"
                  : "bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-md shadow-indigo-900/30"
              }`}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo MasterFleetBR" className="h-full w-full object-contain" />
              ) : (
                <span>MF</span>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-white tracking-tight truncate max-w-[170px]" title={empresaNome ?? "Empresa"}>
                {empresaNome?.trim() || "Empresa"}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">MasterFleetBR</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="xl:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
          const items = LINKS.filter((l) => {
            if (billingRestricted) {
              return l.group === group && l.href === "/financeiro";
            }
            if (l.href === "/convide-e-ganhe" && !canShowReferralMenu) return false;
            return l.group === group && hasModulo(l.modulo);
          });
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-1">
              <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {group}
              </div>
              {items.map((link) => {
                const ativo = isAtivo(link.href);

                if (link.href === "/inventario") {
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={parentItemClass(ativo)}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setInventarioOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/inventario"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={inventarioOpen ? "Recolher submenu de inventário" : "Expandir submenu de inventário"}
                        >
                          {inventarioOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {inventarioOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {INVENTARIO_SUBLINKS.filter(() => hasModulo("inventario")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (link.href === "/financeiro") {
                  if (billingRestricted) {
                    const ativoMeuPlano = pathname === "/configuracoes/meu-plano" || pathname?.startsWith("/configuracoes/meu-plano/");
                    return (
                      <div key={link.href} className="mx-2">
                        <Link href="/configuracoes/meu-plano" className={parentItemClass(Boolean(ativoMeuPlano))} onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>Meu plano</span>
                          </span>
                        </Link>
                      </div>
                    );
                  }
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={parentItemClass(ativo)}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setFinanceiroOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/financeiro"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={financeiroOpen ? "Recolher submenu de financeiro" : "Expandir submenu de financeiro"}
                        >
                          {financeiroOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {financeiroOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {FINANCEIRO_SUBLINKS.filter(() => hasModulo("financeiro")).map((sub) => {
                            const subAtivo = sub.href.includes("?tipo=")
                              ? pathname === "/financeiro/contas" && searchParams?.get("tipo") === sub.href.split("tipo=")[1]
                              : isAtivo(sub.href);

                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (link.href === "/manutencao") {
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={parentItemClass(ativo)}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setManutencaoOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/manutencao"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={manutencaoOpen ? "Recolher submenu de manutenção" : "Expandir submenu de manutenção"}
                        >
                          {manutencaoOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {manutencaoOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {MANUTENCAO_SUBLINKS.filter(() => hasModulo("manutencao")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (link.href === "/oficina") {
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={parentItemClass(ativo)}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setOficinaOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/oficina"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={oficinaOpen ? "Recolher submenu de oficina" : "Expandir submenu de oficina"}
                        >
                          {oficinaOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {oficinaOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {OFICINA_SUBLINKS.filter(() => hasModulo("oficina")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (link.href === "/escolar") {
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={parentItemClass(ativo)}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEscolarOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/escolar"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={escolarOpen ? "Recolher submenu escolar" : "Expandir submenu escolar"}
                        >
                          {escolarOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {escolarOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {ESCOLAR_SUBLINKS.filter(() => hasModulo("escolar")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (link.href === "/fretamentos") {
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={parentItemClass(ativo)}
                      >
                        <Link href="/fretamentos/eventual" className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setFretamentosOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/fretamentos"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={fretamentosOpen ? "Recolher submenu de fretamentos" : "Expandir submenu de fretamentos"}
                        >
                          {fretamentosOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {fretamentosOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {FRETAMENTOS_SUBLINKS.filter(() => hasModulo("operacional")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (link.href === "/configuracoes") {
                  if (billingRestricted) {
                    return null;
                  }
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={parentItemClass(ativo)}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfiguracoesOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/configuracoes"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={configuracoesOpen ? "Recolher submenu de configurações" : "Expandir submenu de configurações"}
                        >
                          {configuracoesOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {configuracoesOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {CONFIGURACOES_SUBLINKS.filter(() => hasModulo("operacional")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (link.href === "/relatorios") {
                  return (
                    <div key={link.href} className="mx-2">
                      <div className={parentItemClass(ativo)}>
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          <span className="flex items-center gap-2">
                            <span className="text-base leading-none">{link.icon}</span>
                            <span>{link.label}</span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setRelatoriosOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/relatorios"))))}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={relatoriosOpen ? "Recolher submenu de relatórios" : "Expandir submenu de relatórios"}
                        >
                          {relatoriosOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {relatoriosOpen ? (
                        <div className="mt-1 mb-2 ml-3 border-l border-slate-700/80 pl-2 space-y-0.5">
                          {RELATORIOS_SUBLINKS.filter(() => hasModulo("operacional")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={subItemClass(subAtivo)}
                              >
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className={`mx-2 ${parentItemClass(ativo)}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base leading-none">{link.icon}</span>
                      <span>{link.label}</span>
                      {link.href === "/suporte" && supportUnread > 0 ? (
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" aria-label="Há mensagens novas no suporte" />
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
