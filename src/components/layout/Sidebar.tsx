"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Clientes", href: "/clientes" },
  { label: "Contratos", href: "/contratos" }, // ✅ NOVO
  { label: "Veículos", href: "/veiculos" },
  { label: "Motoristas", href: "/motoristas" },
  { label: "Ordens de Serviço", href: "/ordens-servico" },
  { label: "Financeiro", href: "/financeiro" },
  { label: "Manutenção", href: "/manutencao" },
  { label: "Relatórios", href: "/relatorios" },
  { label: "Configurações", href: "/configuracoes" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen w-72 shrink-0 border-r border-slate-800/80 bg-slate-950 text-slate-200">
      <div className="flex h-full flex-col p-4">
        {/* Brand */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/30 p-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800/70 text-sm font-extrabold">
            MF
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-100">
              MasterFleetBR
            </div>
            <div className="text-xs text-slate-400">Painel</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-4 flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-900/60 hover:text-slate-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-900/20 p-3">
          <div className="text-xs text-slate-400">v0.1 • Base</div>
        </div>
      </div>
    </aside>
  );
}