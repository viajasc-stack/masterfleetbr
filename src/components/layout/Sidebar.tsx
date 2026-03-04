"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: string;
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
];

const LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◼", group: "Operacional" },
  { href: "/ordens-servico", label: "Ordens de Serviço", icon: "◼", group: "Operacional" },
  { href: "/orcamentos", label: "Orçamentos", icon: "◼", group: "Operacional" },
  { href: "/contratos", label: "Contratos", icon: "◼", group: "Operacional" },
  { href: "/agenda", label: "Agenda", icon: "◼", group: "Operacional" },
  { href: "/clientes", label: "Clientes", icon: "◼", group: "Operacional" },
  { href: "/motoristas", label: "Motoristas", icon: "◼", group: "Operacional" },
  { href: "/usuarios", label: "Usuários", icon: "◼", group: "Operacional" },
  { href: "/veiculos", label: "Veículos", icon: "◼", group: "Operacional" },
  { href: "/inventario", label: "Inventário", icon: "◼", group: "Gestão" },
  { href: "/financeiro", label: "Financeiro", icon: "◼", group: "Gestão" },
  { href: "/manutencao", label: "Manutenção", icon: "◼", group: "Gestão" },
  { href: "/relatorios", label: "Relatórios", icon: "◼", group: "Gestão" },
  { href: "/configuracoes", label: "Configurações", icon: "◼", group: "Administrativo" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inventarioOpen, setInventarioOpen] = useState(false);
  const [financeiroOpen, setFinanceiroOpen] = useState(false);

  useEffect(() => {
    if (pathname?.startsWith("/inventario")) {
      setInventarioOpen(true);
    }
    if (pathname?.startsWith("/financeiro")) {
      setFinanceiroOpen(true);
    }
  }, [pathname]);

  function isAtivo(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname?.startsWith(href + "/");
  }

  return (
    <aside className="w-60 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-800">
        <div className="text-base font-bold text-white tracking-tight">MasterFleetBR</div>
        <div className="text-xs text-slate-400 mt-0.5">Painel da Empresa</div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
          const items = LINKS.filter((l) => l.group === group);
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
                          onClick={() => setInventarioOpen((v) => !v)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={inventarioOpen ? "Recolher submenu de inventário" : "Expandir submenu de inventário"}
                        >
                          {inventarioOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {inventarioOpen ? (
                        <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                          {INVENTARIO_SUBLINKS.map((sub) => {
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
                          onClick={() => setFinanceiroOpen((v) => !v)}
                          className="text-xs text-slate-400 hover:text-slate-200"
                          aria-label={financeiroOpen ? "Recolher submenu de financeiro" : "Expandir submenu de financeiro"}
                        >
                          {financeiroOpen ? "▾" : "▸"}
                        </button>
                      </div>

                      {financeiroOpen ? (
                        <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                          {FINANCEIRO_SUBLINKS.map((sub) => {
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
                    {link.label}
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
