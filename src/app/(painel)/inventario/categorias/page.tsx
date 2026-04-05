"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Categoria = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  cor_icone: string | null;
};

export default function CategoriasEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase
      .from("categorias_estoque")
      .select("id, nome, descricao, ativo, cor_icone")
      .order("nome");

    if (error) setErro(error.message);
    setCategorias((data as Categoria[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function excluirSelecionada() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("categorias_estoque").delete().eq("id", deleteTarget.id);
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
        title="Estoque · Categorias"
        description="Listagem de categorias com status e ações de manutenção."
        actions={
          <Link href="/inventario/categorias/nova" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">
            + Adicionar categoria
          </Link>
        }
      />

      {erro ? <div className="rounded-md border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : categorias.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhuma categoria cadastrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Descrição</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.nome}</td>
                    <td className="py-2 pr-4 text-slate-600">{c.descricao ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded px-2 py-1 text-xs border ${c.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-700 bg-slate-50"}`}>
                        {c.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/inventario/categorias/${c.id}`}
                          className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                          title="Editar categoria"
                        >
                          ✏️
                        </Link>
                        <button
                          type="button"
                          className="px-2 py-1 text-xs border border-rose-200 text-rose-700 rounded hover:bg-rose-50"
                          onClick={() => setDeleteTarget(c)}
                          title="Excluir categoria"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Excluir categoria"
        description={`Deseja excluir a categoria "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionada}
      />
    </div>
  );
}
