"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { supabase } from "@/lib/supabase/client";

type SidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
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
  { href: "/inventario/transferencias", label: "Transferências" },
  { href: "/inventario/ajustes-estoque", label: "Ajustes de Estoque" },
  { href: "/inventario/inventario-fisico", label: "Inventário Físico" },
  { href: "/inventario/alertas-reposicao", label: "Alertas e Reposição" },
  { href: "/inventario/relatorios", label: "Relatórios" },
  { href: "/inventario/configuracoes", label: "Configurações" },
];

const FINANCEIRO_SUBLINKS = [
  { href: "/financeiro", label: "Dashboard" },
  { href: "/financeiro/contas", label: "Todas as contas" },
  { href: "/financeiro/contas?tipo=pagar", label: "Contas a pagar" },
  { href: "/financeiro/contas?tipo=receber", label: "Contas a receber" },
  { href: "/financeiro/assinatura", label: "Assinatura" },
  { href: "/financeiro/faturas", label: "Faturas" },
];

const MANUTENCAO_SUBLINKS = [
  { href: "/manutencao", label: "Painel" },
  { href: "/manutencao/oficina", label: "Painel oficina (PDV)" },
  { href: "/manutencao/nova", label: "Nova solicitação" },
  { href: "/manutencao/compras", label: "Compras da manutenção" },
  { href: "/manutencao/preventivas", label: "Preventivas" },
  { href: "/manutencao/indicadores", label: "Indicadores" },
  { href: "/manutencao/estoque", label: "Estoque da manutenção" },
  { href: "/manutencao/estoque/reservas", label: "Reservas de peças" },
  { href: "/manutencao/estoque/consumo", label: "Consumo/baixas" },
];

const FRETAMENTOS_SUBLINKS = [
  { href: "/fretamentos/eventual", label: "Eventual" },
  { href: "/fretamentos/recorrente", label: "Recorrente" },
];

const CONFIGURACOES_SUBLINKS = [
  { href: "/configuracoes", label: "Geral" },
  { href: "/configuracoes/dashboard", label: "Dashboard" },
  { href: "/configuracoes/checklist", label: "Checklist" },
  { href: "/configuracoes/fretamento-recorrente", label: "Fretamento recorrente" },
  { href: "/configuracoes/google-agenda", label: "Google Agenda" },
  { href: "/configuracoes/pagamentos", label: "Pagamentos" },
];

const LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◼", group: "Operacional", modulo: "dashboard" },
  { href: "/ordens-servico", label: "Ordens de Serviço", icon: "◼", group: "Operacional", modulo: "ordens_servico" },
  { href: "/veiculos", label: "Veículos", icon: "◼", group: "Operacional", modulo: "veiculos" },
  { href: "/motoristas", label: "Motoristas", icon: "◼", group: "Operacional", modulo: "motoristas" },
  { href: "/fretamentos", label: "Fretamentos", icon: "◼", group: "Operacional", modulo: "ordens_servico" },
  { href: "/contratos", label: "Contratos", icon: "◼", group: "Operacional", modulo: "ordens_servico" },
  { href: "/clientes", label: "Clientes", icon: "◼", group: "Operacional", modulo: "clientes" },
  { href: "/inventario", label: "Estoque", icon: "◼", group: "Gestão", modulo: "inventario" },
  { href: "/financeiro", label: "Financeiro", icon: "◼", group: "Gestão", modulo: "financeiro" },
  { href: "/manutencao", label: "Manutenção", icon: "◼", group: "Gestão", modulo: "manutencao" },
  { href: "/abastecimentos", label: "Abastecimentos", icon: "◼", group: "Gestão", modulo: "ordens_servico" },
  { href: "/orcamentos", label: "Orçamentos", icon: "◼", group: "Gestão", modulo: "ordens_servico" },
  { href: "/agenda", label: "Agenda", icon: "◼", group: "Gestão", modulo: "agenda" },
  { href: "/viagens", label: "Viagens", icon: "◼", group: "Gestão", modulo: "viagens" },
  { href: "/relatorios", label: "Relatórios", icon: "◼", group: "Gestão", modulo: "relatorios" },
  { href: "/suporte", label: "Suporte", icon: "◼", group: "Administrativo", modulo: "suporte" },
  { href: "/configuracoes", label: "Configurações", icon: "◼", group: "Administrativo", modulo: "configuracoes" },
];

export default function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inventarioOpenManual, setInventarioOpenManual] = useState<boolean | null>(null);
  const [financeiroOpenManual, setFinanceiroOpenManual] = useState<boolean | null>(null);
  const [manutencaoOpenManual, setManutencaoOpenManual] = useState<boolean | null>(null);
  const [fretamentosOpenManual, setFretamentosOpenManual] = useState<boolean | null>(null);
  const [configuracoesOpenManual, setConfiguracoesOpenManual] = useState<boolean | null>(null);
  const [canUseAllModules, setCanUseAllModules] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [canShowReferralMenu, setCanShowReferralMenu] = useState(false);

  useEffect(() => {
    async function loadModules() {
      const access = await loadEmpresaModuleAccess();
      setCanUseAllModules(access.canUseAllModules);
      setAllowedModules(access.allowedModules);
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
    }
    const t = setTimeout(() => {
      void loadReferralMenuVisibility();
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  const inventarioOpen = inventarioOpenManual ?? Boolean(pathname?.startsWith("/inventario"));
  const financeiroOpen = financeiroOpenManual ?? Boolean(pathname?.startsWith("/financeiro"));
  const manutencaoOpen = manutencaoOpenManual ?? Boolean(pathname?.startsWith("/manutencao"));
  const fretamentosOpen = fretamentosOpenManual ?? Boolean(pathname?.startsWith("/fretamentos"));
  const configuracoesOpen = configuracoesOpenManual ?? Boolean(pathname?.startsWith("/configuracoes"));

  function isAtivo(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(href + "/");
  }

  function hasModulo(modulo: string) {
    if (canUseAllModules) return true;
    return allowedModules.includes(modulo);
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
        className={`fixed xl:static inset-y-0 left-0 z-40 w-72 xl:w-60 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        }`}
      >
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold text-white tracking-tight">MasterFleetBR</div>
            <div className="text-xs text-slate-400 mt-0.5">Painel da Empresa</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="xl:hidden inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 text-slate-300"
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
          const items = LINKS.filter((l) => {
            if (l.href === "/convide-e-ganhe" && !canShowReferralMenu) return false;
            return l.group === group && hasModulo(l.modulo);
          });
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-1">
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group}
              </div>
              {items.map((link) => {
                const ativo = isAtivo(link.href);

                if (link.href === "/inventario") {
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          ativo
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                        }`}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          {link.label}
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
                        <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                          {INVENTARIO_SUBLINKS.filter(() => hasModulo("inventario")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                                  subAtivo
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                                }`}
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
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          ativo
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                        }`}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          {link.label}
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
                        <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                          {FINANCEIRO_SUBLINKS.filter(() => hasModulo("financeiro")).map((sub) => {
                            const subAtivo = sub.href.includes("?tipo=")
                              ? pathname === "/financeiro/contas" && searchParams?.get("tipo") === sub.href.split("tipo=")[1]
                              : isAtivo(sub.href);

                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                                  subAtivo
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                                }`}
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
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          ativo
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                        }`}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          {link.label}
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
                        <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                          {MANUTENCAO_SUBLINKS.filter(() => hasModulo("manutencao")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                                  subAtivo
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                                }`}
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
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          ativo
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                        }`}
                      >
                        <Link href="/fretamentos/eventual" className="flex-1" onClick={onClose}>
                          {link.label}
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
                        <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                          {FRETAMENTOS_SUBLINKS.filter(() => hasModulo("ordens_servico")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                                  subAtivo
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                                }`}
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
                  return (
                    <div key={link.href} className="mx-2">
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          ativo
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                        }`}
                      >
                        <Link href={link.href} className="flex-1" onClick={onClose}>
                          {link.label}
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
                        <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                          {CONFIGURACOES_SUBLINKS.filter(() => hasModulo("configuracoes")).map((sub) => {
                            const subAtivo = isAtivo(sub.href);
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={onClose}
                                className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                                  subAtivo
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                                }`}
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
                    className={`flex items-center gap-2 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      ativo
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
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
