"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Manutencao = {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  data_prevista: string | null;
  data_realizada: string | null;
  km_previsto: number | null;
  custo: number | null;
  created_at: string;
  veiculos: { placa: string; modelo: string | null } | null;
};

function badgeStatus(s: string) {
  if (s === "concluida") return "border-green-200 text-green-700 bg-green-50";
  if (s === "cancelada") return "border-slate-200 text-slate-500 bg-slate-50";
  if (s === "em_andamento") return "border-blue-200 text-blue-700 bg-blue-50";
  return "border-amber-200 text-amber-700 bg-amber-50";
}

export default function ManutencaoPage() {
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("pendente");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("manutencoes")
      .select("id, tipo, descricao, status, data_prevista, data_realizada, km_previsto, custo, created_at, veiculos(placa, modelo)")
      .order("data_prevista", { ascending: true });
    setTimeout(() => {
      setManutencoes((data as unknown as Manutencao[]) ?? []);
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const hoje = new Date().toISOString().slice(0, 10);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return manutencoes
      .filter((m) => filtroStatus === "todos" || m.status === filtroStatus)
      .filter((m) => !q || [m.tipo, m.descricao, m.veiculos?.placa ?? ""].join(" ").toLowerCase().includes(q));
  }, [manutencoes, filtroStatus, busca]);

  const alertas = manutencoes.filter(
    (m) => m.status === "pendente" && m.data_prevista && m.data_prevista <= hoje
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção"
        description="Plano de manutenção preventiva e corretiva da frota."
        actions={
          <>
            <Link href="/manutencao/nova" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Nova Manutenção
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </>
        }
      />

      {alertas.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-amber-300">
          {alertas.length} manutenção(ões) vencida(s) aguardando execução.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={busca}
              onChange={(e) => setBusca(e.target.value)} placeholder="Tipo, veículo, descrição..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida">Concluída</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          Mostrando <strong>{filtradas.length}</strong> de <strong>{manutencoes.length}</strong>.
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-slate-600">Nenhuma manutenção encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Descrição</th>
                  <th className="py-2 pr-4">Prev. Data</th>
                  <th className="py-2 pr-4">KM Prev.</th>
                  <th className="py-2 pr-4">Custo</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((m) => {
                  const vencida = m.status === "pendente" && m.data_prevista && m.data_prevista <= hoje;
                  return (
                    <tr key={m.id} className={`border-b last:border-0 hover:bg-slate-50 ${vencida ? "bg-red-50/50" : ""}`}>
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/manutencao/${m.id}`} className="hover:underline">
                          {m.veiculos?.placa ?? "—"}
                        </Link>
                        {m.veiculos?.modelo && <div className="text-xs text-slate-500">{m.veiculos.modelo}</div>}
                      </td>
                      <td className="py-2 pr-4">{m.tipo}</td>
                      <td className="py-2 pr-4 text-slate-500 max-w-[200px] truncate">{m.descricao}</td>
                      <td className={`py-2 pr-4 ${vencida ? "text-red-600 font-medium" : "text-slate-500"}`}>
                        {m.data_prevista ? new Date(m.data_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                        {vencida && " ⚠"}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{m.km_previsto ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {m.custo != null ? m.custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-1 rounded border ${badgeStatus(m.status)}`}>
                          {m.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
