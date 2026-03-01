"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Empresa = {
  id: string;
  nome: string;
  created_at: string;
  assinaturas: {
    status: string;
    trial_ate: string | null;
    proxima_cobranca: string | null;
    planos: { nome: string } | null;
  }[] | null;
};

function badgeStatus(s: string) {
  if (s === "ativa") return "border-green-200 text-green-700 bg-green-50";
  if (s === "trial") return "border-blue-200 text-blue-700 bg-blue-50";
  if (s === "past_due") return "border-amber-200 text-amber-700 bg-amber-50";
  if (s === "bloqueada") return "border-red-200 text-red-700 bg-red-50";
  return "border-slate-200 text-slate-500";
}

export default function MasterEmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("empresas")
      .select("id, nome, created_at, assinaturas(status, trial_ate, proxima_cobranca, planos(nome))")
      .order("created_at", { ascending: false });
    setEmpresas((data as unknown as Empresa[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas
      .filter((e) => {
        if (filtroStatus === "todos") return true;
        const s = e.assinaturas?.[0]?.status ?? "sem_assinatura";
        return s === filtroStatus;
      })
      .filter((e) => !q || e.nome.toLowerCase().includes(q));
  }, [empresas, busca, filtroStatus]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Empresas</h1>
          <p className="text-slate-400 mt-0.5 text-sm">{empresas.length} empresa(s) cadastrada(s)</p>
        </div>
        <button onClick={carregar} className="border border-slate-700 text-slate-400 hover:text-white px-4 py-2 rounded-lg text-sm transition">
          Recarregar
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-400 mb-1">Buscar</label>
            <input className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-slate-500"
              value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome da empresa..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
            <select className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white outline-none"
              value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="ativa">Ativa</option>
              <option value="trial">Trial</option>
              <option value="past_due">Past Due</option>
              <option value="bloqueada">Bloqueada</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">Nenhuma empresa encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-slate-400 font-medium">Empresa</th>
                <th className="px-5 py-3 text-slate-400 font-medium">Plano</th>
                <th className="px-5 py-3 text-slate-400 font-medium">Status</th>
                <th className="px-5 py-3 text-slate-400 font-medium">Próx. Cobrança</th>
                <th className="px-5 py-3 text-slate-400 font-medium">Cadastro</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e) => {
                const assinatura = e.assinaturas?.[0];
                return (
                  <tr key={e.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition">
                    <td className="px-5 py-3 font-medium text-white">{e.nome}</td>
                    <td className="px-5 py-3 text-slate-400">{assinatura?.planos?.nome ?? "—"}</td>
                    <td className="px-5 py-3">
                      {assinatura ? (
                        <span className={`text-xs px-2 py-1 rounded border ${badgeStatus(assinatura.status)}`}>
                          {assinatura.status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">sem assinatura</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {assinatura?.proxima_cobranca
                        ? new Date(assinatura.proxima_cobranca).toLocaleDateString("pt-BR")
                        : assinatura?.trial_ate
                        ? `Trial até ${new Date(assinatura.trial_ate).toLocaleDateString("pt-BR")}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/master/empresas/${e.id}`}
                        className="text-xs text-sky-400 hover:underline">
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
