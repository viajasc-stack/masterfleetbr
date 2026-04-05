"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Produto = {
  id: string;
  nome: string;
  categoria: string | null;
  ativo: boolean;
};

type SaldoMini = { produto_id: string; quantidade: number };

export default function ItensEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<Produto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | "ativos" | "inativos">("ativos");

  async function carregar() {
    setLoading(true);
    setErro("");

    const { data, error } = await supabase
      .from("produtos")
      .select("id, nome, categoria, ativo")
      .order("nome");

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    const rows = (data as Produto[] | null) ?? [];
    setProdutos(rows);

    if (rows.length > 0) {
      const ids = rows.map((p) => p.id);
      const { data: saldosData } = await supabase
        .from("saldos_estoque")
        .select("produto_id, quantidade")
        .in("produto_id", ids);

      const map: Record<string, number> = {};
      ((saldosData ?? []) as SaldoMini[]).forEach((s) => {
        map[s.produto_id] = (map[s.produto_id] ?? 0) + Number(s.quantidade ?? 0);
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
    return produtos
      .filter((p) => (status === "todos" ? true : status === "ativos" ? p.ativo : !p.ativo))
      .filter((p) => !q || [p.nome, p.categoria ?? ""].join(" ").toLowerCase().includes(q));
  }, [produtos, busca, status]);

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("produtos").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setDeleteTarget(null);
    await carregar();
  }

  return (
    <div className="space-y-6">
      {erro ? <div className="text-sm rounded border border-rose-300 bg-rose-50 text-rose-700 px-3 py-2">{erro}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-4 gap-3">
        <input className="md:col-span-3 border border-slate-300 rounded-md px-3 py-2" placeholder="Buscar por nome ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as "todos" | "ativos" | "inativos")}> 
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
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
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">Categoria</th>
                <th className="py-2 pr-4">Quantidade em estoque</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const saldo = saldos[p.id] ?? 0;
                return (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{p.nome}</td>
                    <td className="py-2 pr-4 text-slate-600">{p.categoria ?? "—"}</td>
                    <td className="py-2 pr-4 font-semibold">{saldo}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded px-2 py-1 text-xs border ${p.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-700 bg-slate-50"}`}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/inventario/produtos/${p.id}`}
                          className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                          title="Editar produto"
                        >
                          ✏️
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
                          title="Excluir produto"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Excluir produto"
        description={`Deseja excluir o produto "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />
    </div>
  );
}
