"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function MasterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [configOpenManual, setConfigOpenManual] = useState<boolean | null>(null);
  const [supportUnread, setSupportUnread] = useState(0);

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

  useEffect(() => {
    if (!ok) return;
    async function loadSupportUnread() {
      const { data } = await supabase.rpc("master_support_unread_count");
      setSupportUnread(Number(data ?? 0));
    }
    const t = setTimeout(() => {
      void loadSupportUnread();
    }, 0);
    return () => clearTimeout(t);
  }, [ok, pathname]);

  if (!ok) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm">
      Verificando acesso...
    </div>
  );

  const links = [
    { href: "/master", label: "Visão Geral" },
    { href: "/master/governanca", label: "Governança" },
    { href: "/master/empresas", label: "Empresas" },
    { href: "/master/cupons", label: "Cupons" },
    { href: "/master/modulos", label: "Módulos" },
    { href: "/master/suporte", label: "Suporte" },
    { href: "/master/planos", label: "Planos" },
    { href: "/master/financeiro", label: "Financeiro" },
    { href: "/master/seguranca", label: "Segurança" },
    { href: "/master/operacoes", label: "Operações" },
    { href: "/master/configuracoes", label: "Configurações" },
  ];
  const configOpen = configOpenManual ?? Boolean(pathname?.startsWith("/master/configuracoes"));

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-60 border-r border-slate-800 bg-slate-900 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800">
          <div className="text-base font-bold text-white tracking-tight">MasterFleetBR</div>
          <div className="text-xs text-slate-400 mt-0.5">Painel Master</div>
        </div>
        <nav className="p-2 flex-1 overflow-y-auto">
          {links.map((l) => {
            const ativo = l.href === "/master" ? pathname === "/master" : pathname?.startsWith(l.href);

            if (l.href === "/master/configuracoes") {
              return (
                <div key={l.href} className="mx-1">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${ativo ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
                    <Link href={l.href} className="flex-1">{l.label}</Link>
                    <button
                      type="button"
                      onClick={() => setConfigOpenManual((v) => !(v ?? Boolean(pathname?.startsWith("/master/configuracoes"))))}
                      className="text-xs text-slate-400 hover:text-slate-200"
                      aria-label={configOpen ? "Recolher submenu de configurações" : "Expandir submenu de configurações"}
                    >
                      {configOpen ? "▾" : "▸"}
                    </button>
                  </div>

                  {configOpen ? (
                    <div className="mt-1 mb-1 ml-2 border-l border-slate-800 pl-2">
                      {[
                        { href: "/master/configuracoes", label: "Geral" },
                        { href: "/master/configuracoes/aparencia", label: "Aparência" },
                        { href: "/master/configuracoes/mercado-pago", label: "Mercado Pago" },
                        { href: "/master/configuracoes/asaas", label: "Asaas" },
                        { href: "/master/configuracoes/whatsapp", label: "WhatsApp" },
                      ].map((sub) => {
                        const subAtivo = pathname === sub.href || pathname?.startsWith(sub.href + "/");
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`block px-3 py-1.5 rounded-md text-sm transition ${subAtivo ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}
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

            const hasUnreadSupport = l.href === "/master/suporte" && supportUnread > 0;
            return (
              <Link key={l.href} href={l.href}
                className={`block mx-1 px-3 py-2 rounded-lg text-sm transition ${ativo ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"}`}>
                <span className="inline-flex items-center gap-2">
                  <span>{l.label}</span>
                  {hasUnreadSupport ? (
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" aria-label="Há mensagens novas no suporte" />
                  ) : null}
                </span>
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
            <button
              onClick={() => {
                void supabase.auth.signOut({ scope: "local" });
                if (typeof window !== "undefined") window.location.replace("/login?logout=1");
              }}
              className="text-sm text-white/80 hover:text-white transition"
            >
              Sair
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
