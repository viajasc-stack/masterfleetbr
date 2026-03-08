"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { supabase } from "@/lib/supabase/client";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [usuarioNome, setUsuarioNome] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      setUsuarioNome(profile?.nome ?? null);

      const { data: master } = await supabase.rpc("is_super_admin");
      setIsSuperAdmin(Boolean(master));

      if (profile?.empresa_id) {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("nome")
          .eq("id", profile.empresa_id)
          .maybeSingle();
        setEmpresaNome(empresa?.nome ?? null);
      }
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar empresaNome={empresaNome} usuarioNome={usuarioNome} isSuperAdmin={isSuperAdmin} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
