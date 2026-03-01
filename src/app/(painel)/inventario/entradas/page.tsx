"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Entrada = {
  id: string;
  numero: number | null;
  status: string;
  data_entrada: string | null;
  nota_fiscal: string | null;
  fornecedor: string | null;
  valor_total: number | null;
  created_at: string;
  produtos: { nome: string } | null;
  depositos: { nome: string } | null;
};

function badgeStatus(s: string) {
  if (s === "recebido") return "border-green-200 text-green-700 bg-green-50";
  if (s === "cancelado") return "border-red-200 text-red-700 bg-red-50";
  return "border-amber-200 text-amber-700 bg-amber-50";
}

export default function EntradasPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("entradas_estoque")
      .select("id, numero, status, data_entrada, nota_fiscal, fornecedor, valor_total, created_at, produtos(nome), depositos(nome)")
      .order("created_at", { ascending: false });
    setTimeout(() => {
      setEntradas((data as unknown as Entrada[]) ?? []);
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return entradas
      .filter((e) => filtroStatus === "todos" || e.status === filtroStatus)
      .filter((e) => !q || [e.fornecedor ?? "", e.nota_fiscal ?? "", e.produtos?.nome ?? ""].join(" ").toLowerCase().includes(q));
  }, [entradas, filtroStatus, busca]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entradas de Estoque"
        description="Recebimentos e compras de produtos."
        actions={
          <>
            <Link href="/inventario/entradas/nova" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Nova Entrada
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={busca}
              onChange={(e) => setBusca(e.target.value)} placeholder="Fornecedor, nota fiscal, produto..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="recebido">Recebido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          Mostrando <strong>{filtradas.length}</strong> de <strong>{entradas.length}</strong> entrada(s).
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-slate-600">Nenhuma entrada encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Nº</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Fornecedor</th>
                  <th className="py-2 pr-4">Depósito</th>
                  <th className="py-2 pr-4">NF</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/inventario/entradas/${e.id}`} className="hover:underline">
                        {e.numero ? `ENT-${String(e.numero).padStart(4, "0")}` : "—"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{e.produtos?.nome ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{e.fornecedor ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{e.depositos?.nome ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-500">{e.nota_fiscal ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {e.valor_total != null ? e.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-1 rounded border ${badgeStatus(e.status)}`}>{e.status}</span>
                    </td>
                    <td className="py-2 text-slate-500">
                      {e.data_entrada ? new Date(e.data_entrada).toLocaleDateString("pt-BR") : new Date(e.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
