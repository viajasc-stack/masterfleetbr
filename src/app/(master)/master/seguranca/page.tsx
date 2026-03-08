"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SuperAdmin = {
  user_id: string;
  created_at: string;
};

type Perfil = {
  user_id: string;
  role: string;
  empresa_id: string | null;
};

export default function MasterSegurancaPage() {
  const [loading, setLoading] = useState(true);
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [perfis, setPerfis] = useState<Perfil[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [saRes, perfRes] = await Promise.all([
        supabase.from("super_admins").select("user_id, created_at").order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id, role, empresa_id").limit(1000),
      ]);

      setSuperAdmins((saRes.data as SuperAdmin[]) ?? []);
      setPerfis((perfRes.data as Perfil[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const rolesResumo = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of perfis) {
      counts[p.role] = (counts[p.role] ?? 0) + 1;
    }
    return counts;
  }, [perfis]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Segurança & Acesso</h1>
        <p className="text-slate-600 text-sm mt-0.5">Governança de acesso administrativo da plataforma</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-5">
              <div className="text-xs text-violet-700">Super Admins</div>
              <div className="text-2xl font-bold text-violet-900 mt-1">{superAdmins.length}</div>
            </div>
            {Object.entries(rolesResumo).map(([role, total]) => (
              <div key={role} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs text-slate-500">Role: {role}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{total}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Super Admins ativos</h2>
            {superAdmins.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum super admin listado.</p>
            ) : (
              <div className="space-y-2">
                {superAdmins.map((s) => (
                  <div key={s.user_id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-xs text-slate-700 font-mono">{s.user_id}</span>
                    <span className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
