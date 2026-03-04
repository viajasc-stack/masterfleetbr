"use client";

import NotificationsDropdown from "@/components/layout/NotificationsDropdown";
import { supabase } from "@/lib/supabase/client";

type Props = {
  empresaNome: string | null;
  usuarioNome: string | null;
};

export default function Topbar({ empresaNome, usuarioNome }: Props) {
  function handleLogout() {
    // Não bloqueia navegação esperando rede
    void supabase.auth.signOut({ scope: "local" });
    if (typeof window !== "undefined") {
      window.location.replace("/login?logout=1");
    }
  }

  return (
    <header className="h-16 border-b border-slate-800 bg-gradient-to-r from-violet-700 to-indigo-700 flex items-center justify-between px-6 gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/90">{empresaNome ?? "Empresa"}</span>
        <span className="text-white/60">•</span>
        <span className="text-sm text-white">{usuarioNome ?? "Admin"}</span>
      </div>
      <div className="flex-1 flex items-center">
        <input
          className="w-full max-w-xl bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:border-white/40"
          placeholder="Buscar em clientes, veículos, OS..."
        />
      </div>
      <div className="flex items-center gap-4">
        <NotificationsDropdown />
        <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs">
          {usuarioNome ? usuarioNome.charAt(0).toUpperCase() : "U"}
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-white/80 hover:text-white transition"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
