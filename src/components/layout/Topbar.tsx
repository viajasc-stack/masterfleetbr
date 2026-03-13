"use client";

import NotificationsDropdown from "@/components/layout/NotificationsDropdown";
import { supabase } from "@/lib/supabase/client";

type Props = {
  empresaNome: string | null;
  usuarioNome: string | null;
  isSuperAdmin?: boolean;
  onMenuToggle?: () => void;
};

export default function Topbar({ empresaNome, usuarioNome, isSuperAdmin = false, onMenuToggle }: Props) {
  function handleLogout() {
    // Não bloqueia navegação esperando rede
    void supabase.auth.signOut({ scope: "local" });
    if (typeof window !== "undefined") {
      window.location.replace("/login?logout=1");
    }
  }

  return (
    <header className="min-h-16 border-b border-slate-800 bg-gradient-to-r from-violet-700 to-indigo-700 flex items-center justify-between px-3 sm:px-6 py-2 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/30 text-white"
          aria-label="Abrir menu"
        >
          ☰
        </button>
        <span className="text-sm text-white/90">{empresaNome ?? "Empresa"}</span>
        <span className="text-white/60 hidden sm:inline">•</span>
        <span className="text-sm text-white hidden sm:inline">{usuarioNome ?? "Admin"}</span>
      </div>
      <div className="flex-1 items-center hidden md:flex">
        <input
          className="w-full max-w-xl bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/60 outline-none focus:border-white/40"
          placeholder="Buscar em clientes, veículos, OS..."
        />
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {isSuperAdmin ? (
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/master";
            }}
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-md border border-white/30 text-white hover:bg-white/10 transition"
          >
            Voltar ao Master
          </button>
        ) : null}
        <NotificationsDropdown />
        <div className="w-8 h-8 rounded-full bg-white/20 text-white hidden sm:flex items-center justify-center text-xs">
          {usuarioNome ? usuarioNome.charAt(0).toUpperCase() : "U"}
        </div>
        <button
          onClick={handleLogout}
          className="text-xs sm:text-sm text-white/80 hover:text-white transition"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
