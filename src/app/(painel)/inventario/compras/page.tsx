"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";
import { money } from "@/lib/estoque";

type Pedido = {
  id: string;
  data: string;
  numero_nota: string | null;
  valor_total: number;
  fornecedores?: { nome?: string } | null;
};

export default function ComprasPage() {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Pedido[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Pedido | null>(null);

  async function carregar() {
    setLoading(true);
    setErro("");
    const pedidosResp = await supabase
      .from("pedidos_compra")
      .select("id, data, numero_nota, valor_total, fornecedores(nome)")
      .order("created_at", { ascending: false })
      .limit(150);

    if (pedidosResp.error) setErro(pedidosResp.error.message);
    setLista((pedidosResp.data as Pedido[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function excluirCompra() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("pedidos_compra").delete().eq("id", deleteTarget.id);
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
      <PageHeader
        title="Estoque · Compras"
        description="Entradas de produtos por nota fiscal, com fornecedor, total da nota e ações de edição/exclusão."
        actions={
          <Link href="/inventario/compras/nova" className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500">
            + Adicionar nova compra
          </Link>
        }
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-500">Carregando compras...</div> : null}
        {!loading && lista.length === 0 ? <div className="text-sm text-slate-500">Nenhuma compra registrada.</div> : null}
        {!loading && lista.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Fornecedor</th>
                <th className="py-2 pr-4">Número da nota</th>
                <th className="py-2 pr-4">Valor total da nota</th>
                <th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 pr-4 font-medium">{p.fornecedores?.nome ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{p.numero_nota ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{money(p.valor_total)}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/inventario/compras/${p.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 hover:bg-slate-50" title="Editar compra">
                        ✏️
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-300 hover:bg-rose-50"
                        title="Excluir compra"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Excluir compra"
        description="Essa ação removerá a compra e seus itens vinculados."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => void excluirCompra()}
      />
    </div>
  );
}
