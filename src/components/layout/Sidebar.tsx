"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { supabase } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: string;
  modulo: string;
};

const GROUPS = ["Operacional", "Gestão", "Administrativo"];

const INVENTARIO_SUBLINKS = [
  { href: "/inventario/produtos", label: "Produtos" },
  { href: "/inventario/fornecedores", label: "Fornecedores" },
  { href: "/inventario/entradas", label: "Entradas" },
  { href: "/inventario/depositos", label: "Depósitos" },
  { href: "/inventario/movimentos", label: "Movimentos" },
];

const FINANCEIRO_SUBLINKS = [
  { href: "/financeiro", label: "Dashboard" },
  { href: "/financeiro/contas", label: "Todas as contas" },
  { href: "/financeiro/contas?tipo=pagar", label: "Contas a pagar" },
  { href: "/financeiro/contas?tipo=receber", label: "Contas a receber" },
  { href: "/financeiro/assinatura", label: "Assinatura" },
  { href: "/financeiro/faturas", label: "Faturas" },
];

const LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◼", group: "Operacional", modulo: "dashboard" },
  { href: "/ordens-servico", label: "Ordens de Serviço", icon: "◼", group: "Operacional", modulo: "ordens_servico" },
  { href: "/orcamentos", label: "Orçamentos", icon: "◼", group: "Operacional", modulo: "ordens_servico" },
  { href: "/contratos", label: "Contratos", icon: "◼", group: "Operacional", modulo: "ordens_servico" },
  { href: "/agenda", label: "Agenda", icon: "◼", group: "Operacional", modulo: "agenda" },
  { href: "/clientes", label: "Clientes", icon: "◼", group: "Operacional", modulo: "clientes" },
  { href: "/motoristas", label: "Motoristas", icon: "◼", group: "Operacional", modulo: "motoristas" },
  { href: "/usuarios", label: "Usuários", icon: "◼", group: "Operacional", modulo: "usuarios" },
  { href: "/veiculos", label: "Veículos", icon: "◼", group: "Operacional", modulo: "veiculos" },
  { href: "/abastecimentos", label: "Abastecimentos", icon: "◼", group: "Operacional", modulo: "ordens_servico" },
  { href: "/inventario", label: "Inventário", icon: "◼", group: "Gestão", modulo: "inventario" },
  { href: "/financeiro", label: "Financeiro", icon: "◼", group: "Gestão", modulo: "financeiro" },
  { href: "/manutencao", label: "Manutenção", icon: "◼", group: "Gestão", modulo: "manutencao" },
  { href: "/relatorios", label: "Relatórios", icon: "◼", group: "Gestão", modulo: "relatorios" },
  { href: "/suporte", label: "Suporte", icon: "◼", group: "Administrativo", modulo: "suporte" },
  { href: "/configuracoes", label: "Configurações", icon: "◼", group: "Administrativo", modulo: "configuracoes" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inventarioOpenManual, setInventarioOpenManual] = useState<boolean | null>(null);
  const [financeiroOpenManual, setFinanceiroOpenManual] = useState<boolean | null>(null);
  const [canUseAllModules, setCanUseAllModules] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [supportUnread, setSupportUnread] = useState(0);

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

  const inventarioOpen = inventarioOpenManual ?? Boolean(pathname?.startsWith("/inventario"));
  const financeiroOpen = financeiroOpenManual ?? Boolean(pathname?.startsWith("/financeiro"));

  function isAtivo(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(href + "/");
  }

  function hasModulo(modulo: string) {
    if (canUseAllModules) return true;
    return allowedModules.includes(modulo);
  }

  return (
    <aside className="w-60 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-800">
        <div className="text-base font-bold text-white tracking-tight">MasterFleetBR</div>
        <div className="text-xs text-slate-400 mt-0.5">Painel da Empresa</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
          const items = LINKS.filter((l) => l.group === group && hasModulo(l.modulo));
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
                        <Link href={link.href} className="flex-1">
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
                        <Link href={link.href} className="flex-1">
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
  );
}
