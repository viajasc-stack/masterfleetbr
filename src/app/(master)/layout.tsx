"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data } = await supabase.rpc("is_super_admin");
      if (!data) { router.replace("/dashboard"); return; }
      setOk(true);
    }
    check();
  }, [router]);

  if (!ok) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm">
      Verificando acesso...
    </div>
  );

  const links = [
    { href: "/master", label: "Visão Geral" },
    { href: "/master/empresas", label: "Empresas" },
    { href: "/master/planos", label: "Planos" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-52 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <div className="text-sm font-bold text-white">MasterFleetBR</div>
          <div className="text-xs text-slate-400 mt-0.5">Painel Master</div>
        </div>
        <nav className="p-2 flex-1">
          {links.map((l) => {
            const ativo = l.href === "/master" ? pathname === "/master" : pathname?.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                className={`block px-3 py-2 rounded-lg text-sm transition ${ativo ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white">← Painel da empresa</Link>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-slate-800 bg-gradient-to-r from-violet-700 to-indigo-700 flex items-center justify-between px-6 gap-4">
          <span className="text-xs text-white font-semibold uppercase tracking-wider">Admin Master</span>
          <div className="flex-1 flex items-center">
            <input
              className="w-full max-w-xl bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:border-white/40"
              placeholder="Buscar em empresas, assinaturas..."
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white/80 hover:text-white text-lg">🔔</button>
            <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs">M</div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
