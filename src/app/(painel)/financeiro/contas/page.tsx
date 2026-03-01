"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";

type Conta = {
  id: string;
  descricao: string;
  tipo: "pagar" | "receber";
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  categoria: string | null;
  created_at: string;
};

export default function ContasPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("pendente");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("contas_financeiras")
      .select("id, descricao, tipo, valor, data_vencimento, data_pagamento, status, categoria, created_at")
      .order("data_vencimento", { ascending: true });
    setTimeout(() => {
      setContas((data as Conta[]) ?? []);
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
    return contas
      .filter((c) => filtroTipo === "todos" || c.tipo === filtroTipo)
      .filter((c) => filtroStatus === "todos" || c.status === filtroStatus)
      .filter((c) => !q || [c.descricao, c.categoria ?? ""].join(" ").toLowerCase().includes(q));
  }, [contas, filtroTipo, filtroStatus, busca]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas"
        description="Todas as contas a pagar e a receber."
        actions={
          <>
            <Link href="/financeiro/contas/nova" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Nova Conta
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={busca}
              onChange={(e) => setBusca(e.target.value)} placeholder="Descrição, categoria..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pagar">A Pagar</option>
              <option value="receber">A Receber</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="recebido">Recebido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          Mostrando <strong>{filtradas.length}</strong> de <strong>{contas.length}</strong> conta(s).
          {filtradas.length > 0 && (
            <span className="ml-3">
              Total: <strong className="text-red-600">-{fmt(filtradas.filter((c) => c.tipo === "pagar" && c.status === "pendente").reduce((s, c) => s + c.valor, 0))}</strong>
              {" / "}
              <strong className="text-green-600">+{fmt(filtradas.filter((c) => c.tipo === "receber" && c.status === "pendente").reduce((s, c) => s + c.valor, 0))}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-slate-600">Nenhuma conta encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Descrição</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Categoria</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Vencimento</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const vencida = c.status === "pendente" && c.data_vencimento < hoje;
                  return (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-slate-50 ${vencida ? "bg-red-50/50" : ""}`}>
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/financeiro/contas/${c.id}`} className="hover:underline">{c.descricao}</Link>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-1 rounded border ${c.tipo === "pagar" ? "border-red-200 text-red-700 bg-red-50" : "border-green-200 text-green-700 bg-green-50"}`}>
                          {c.tipo === "pagar" ? "Pagar" : "Receber"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{c.categoria ?? "—"}</td>
                      <td className={`py-2 pr-4 font-semibold ${c.tipo === "pagar" ? "text-red-600" : "text-green-600"}`}>
                        {fmt(c.valor)}
                      </td>
                      <td className={`py-2 pr-4 ${vencida ? "text-red-600 font-medium" : "text-slate-500"}`}>
                        {new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                        {vencida && " ⚠"}
                      </td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-1 rounded border ${
                          c.status === "pago" || c.status === "recebido" ? "border-green-200 text-green-700 bg-green-50"
                          : c.status === "cancelado" ? "border-slate-200 text-slate-500 bg-slate-50"
                          : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                          {c.status}
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
