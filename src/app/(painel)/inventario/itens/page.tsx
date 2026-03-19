"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { money, numberBR } from "@/lib/estoque";

type Item = {
  id: string;
  nome: string;
  codigo_interno: string | null;
  unidade_medida: string;
  estoque_minimo: number | null;
  custo_medio: number | null;
  ativo: boolean;
  categorias_estoque?: { nome?: string } | null;
};

export default function ItensEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [busca, setBusca] = useState("");
  const [somenteBaixo, setSomenteBaixo] = useState(false);
  const [somenteZerado, setSomenteZerado] = useState(false);
  const [status, setStatus] = useState<"todos" | "ativos" | "inativos">("ativos");

  async function carregar() {
    setLoading(true);
    setErro("");

    const { data, error } = await supabase
      .from("itens_estoque")
      .select("id, nome, codigo_interno, unidade_medida, estoque_minimo, custo_medio, ativo, categorias_estoque(nome)")
      .order("nome");

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    const rows = (data as Item[] | null) ?? [];
    setItens(rows);

    if (rows.length > 0) {
      const ids = rows.map((i) => i.id);
      const { data: saldosData } = await supabase
        .from("estoques")
        .select("item_id, quantidade")
        .in("item_id", ids);

      const map: Record<string, number> = {};
      ((saldosData ?? []) as Array<{ item_id: string; quantidade: number }>).forEach((s) => {
        map[s.item_id] = (map[s.item_id] ?? 0) + Number(s.quantidade ?? 0);
      });
      setSaldos(map);
    } else {
      setSaldos({});
    }

    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .filter((i) => (status === "todos" ? true : status === "ativos" ? i.ativo : !i.ativo))
      .filter((i) => !q || [i.nome, i.codigo_interno ?? "", i.categorias_estoque?.nome ?? ""].join(" ").toLowerCase().includes(q))
      .filter((i) => {
        const saldo = saldos[i.id] ?? 0;
        if (somenteZerado && saldo > 0) return false;
        if (somenteBaixo && !(i.estoque_minimo !== null && saldo < Number(i.estoque_minimo))) return false;
        return true;
      });
  }, [itens, saldos, busca, status, somenteBaixo, somenteZerado]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Itens de Estoque"
        description="Gestão completa de itens do estoque com controle de mínimo, custo e status operacional."
        actions={<Link href="/inventario/itens/novo" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">+ Novo item</Link>}
      />

      {erro ? <div className="text-sm rounded border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2">{erro}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-5 gap-3">
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" placeholder="Buscar por nome, código, categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as "todos" | "ativos" | "inativos")}> 
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={somenteBaixo} onChange={(e) => setSomenteBaixo(e.target.checked)} /> Estoque baixo</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={somenteZerado} onChange={(e) => setSomenteZerado(e.target.checked)} /> Zerado</label>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando itens...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhum item encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Código</th>
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Categoria</th>
                <th className="py-2 pr-4">Unidade</th>
                <th className="py-2 pr-4">Estoque atual</th>
                <th className="py-2 pr-4">Mínimo</th>
                <th className="py-2 pr-4">Custo médio</th>
                <th className="py-2 pr-4">Valor total</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const saldo = saldos[i.id] ?? 0;
                const valor = saldo * Number(i.custo_medio ?? 0);
                const baixo = i.estoque_minimo !== null && saldo < Number(i.estoque_minimo);
                return (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-slate-500">{i.codigo_interno ?? "—"}</td>
                    <td className="py-2 pr-4 font-medium">{i.nome}</td>
                    <td className="py-2 pr-4 text-slate-600">{i.categorias_estoque?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{i.unidade_medida}</td>
                    <td className={`py-2 pr-4 font-semibold ${baixo ? "text-rose-600" : ""}`}>{numberBR(saldo, 3)}</td>
                    <td className="py-2 pr-4 text-slate-600">{i.estoque_minimo ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{money(i.custo_medio)}</td>
                    <td className="py-2 pr-4 text-slate-600">{money(valor)}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded px-2 py-1 text-xs border ${i.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-700 bg-slate-50"}`}>
                        {i.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <Link href={`/inventario/itens/${i.id}`} className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50">
                        Visualizar
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
