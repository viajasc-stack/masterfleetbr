"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Movimento = {
  id: string;
  tipo: string;
  quantidade: number;
  origem: string | null;
  created_at: string;
  produtos: { nome: string; unidade: string } | null;
  depositos: { nome: string } | null;
};

export default function MovimentosPage() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("movimentos_estoque")
      .select("id, tipo, quantidade, origem, created_at, produtos(nome, unidade), depositos(nome)")
      .order("created_at", { ascending: false })
      .limit(200);
    setTimeout(() => {
      setMovimentos((data as unknown as Movimento[]) ?? []);
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return movimentos
      .filter((m) => filtroTipo === "todos" || m.tipo === filtroTipo)
      .filter((m) => !q || [m.produtos?.nome ?? "", m.depositos?.nome ?? "", m.origem ?? ""].join(" ").toLowerCase().includes(q));
  }, [movimentos, filtroTipo, busca]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentos de Estoque"
        description="Histórico completo de entradas e saídas (kardex)."
        actions={
          <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
            Recarregar
          </button>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={busca}
              onChange={(e) => setBusca(e.target.value)} placeholder="Produto, depósito, origem..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          Mostrando <strong>{filtrados.length}</strong> de <strong>{movimentos.length}</strong> movimento(s).
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-slate-600">Nenhum movimento encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Data/Hora</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Quantidade</th>
                  <th className="py-2 pr-4">Depósito</th>
                  <th className="py-2">Origem</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-4 text-slate-500">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-4 font-medium">{m.produtos?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-1 rounded border ${
                        m.tipo === "entrada" ? "border-green-200 text-green-700 bg-green-50"
                        : m.tipo === "saida" ? "border-red-200 text-red-700 bg-red-50"
                        : "border-blue-200 text-blue-700 bg-blue-50"}`}>
                        {m.tipo}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{m.quantidade} {m.produtos?.unidade ?? ""}</td>
                    <td className="py-2 pr-4 text-slate-500">{m.depositos?.nome ?? "—"}</td>
                    <td className="py-2 text-slate-500">{m.origem ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link href="/inventario" className="text-sm text-slate-400 hover:text-white">← Voltar ao Inventário</Link>
    </div>
  );
}
