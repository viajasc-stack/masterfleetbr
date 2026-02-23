"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function formatBreadcrumb(pathname: string) {
  if (!pathname || pathname === "/") return "MasterFleetBR";

  const parts = pathname
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);

  // Ex: /ordens-servico -> Ordens de Serviço
  const pretty = parts
    .map((p) =>
      p
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace("Os", "OS")
    )
    .join(" / ");

  return `MasterFleetBR / ${pretty}`;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Erro ao sair: " + error.message);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="text-sm text-slate-600">
        {formatBreadcrumb(pathname)}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="text-sm px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 transition"
          onClick={() => alert("Ajuda (em breve)")}
        >
          Ajuda
        </button>

        <button
          className="text-sm px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
          onClick={handleLogout}
        >
          Sair
        </button>
      </div>
    </div>
  );
}