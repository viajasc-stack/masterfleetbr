"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  group: string;
};

const GROUPS = ["Operacional", "Gestão", "Administrativo"];

const LINKS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◼", group: "Operacional" },
  { href: "/ordens-servico", label: "Ordens de Serviço", icon: "◼", group: "Operacional" },
  { href: "/orcamentos", label: "Orçamentos", icon: "◼", group: "Operacional" },
  { href: "/contratos", label: "Contratos", icon: "◼", group: "Operacional" },
  { href: "/clientes", label: "Clientes", icon: "◼", group: "Operacional" },
  { href: "/motoristas", label: "Motoristas", icon: "◼", group: "Operacional" },
  { href: "/veiculos", label: "Veículos", icon: "◼", group: "Operacional" },
  { href: "/inventario", label: "Inventário", icon: "◼", group: "Gestão" },
  { href: "/financeiro", label: "Financeiro", icon: "◼", group: "Gestão" },
  { href: "/manutencao", label: "Manutenção", icon: "◼", group: "Gestão" },
  { href: "/relatorios", label: "Relatórios", icon: "◼", group: "Gestão" },
  { href: "/configuracoes", label: "Configurações", icon: "◼", group: "Administrativo" },
];

export default function Sidebar() {
  const pathname = usePathname();

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
