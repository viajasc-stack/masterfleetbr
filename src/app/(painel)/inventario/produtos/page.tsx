"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_item: string;
  codigo_interno: string | null;
  unidade: string;
  categoria: string | null;
  controla_estoque: boolean;
  preco_custo: number | null;
  estoque_minimo: number | null;
  estoque_maximo: number | null;
  destaque: boolean;
  ativo: boolean;
  created_at: string;
};

type SaldoMini = { produto_id: string; quantidade: number };

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [saldos, setSaldos] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Produto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<"ativos" | "inativos" | "todos">("ativos");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("produtos")
      .select("id, nome, descricao, tipo_item, codigo_interno, unidade, categoria, controla_estoque, preco_custo, estoque_minimo, estoque_maximo, destaque, ativo, created_at")
      .order("nome");
    if (data) {
      setProdutos(data as Produto[]);
      setSelectedIds((prev) => prev.filter((id) => (data as Produto[]).some((p) => p.id === id)));
      const ids = data.map((p: { id: string }) => p.id);
      if (ids.length > 0) {
        const { data: s } = await supabase.from("saldos_estoque").select("produto_id, quantidade").in("produto_id", ids);
        setTimeout(() => {
          const map: Record<string, number> = {};
          (s as SaldoMini[] ?? []).forEach((r) => { map[r.produto_id] = (map[r.produto_id] ?? 0) + r.quantidade; });
          setSaldos(map);
        }, 0);
      }
    }
    setTimeout(() => setLoading(false), 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos
      .filter((p) => filtroAtivo === "todos" ? true : filtroAtivo === "ativos" ? p.ativo : !p.ativo)
      .filter((p) => !q || [p.nome, p.tipo_item ?? "", p.codigo_interno ?? "", p.categoria ?? "", p.unidade].join(" ").toLowerCase().includes(q));
  }, [produtos, busca, filtroAtivo]);

  const allFilteredSelected =
    filtrados.length > 0 && filtrados.every((p) => selectedIds.includes(p.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...filtrados.map((p) => p.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !filtrados.some((p) => p.id === id)));
  }

  function labelTipoItem(tipo: string) {
    const map: Record<string, string> = {
      peca: "Peça",
      pneu: "Pneu",
      combustivel: "Combustível",
      oleo_lubrificante: "Óleo/Lubrificante",
      acessorio: "Acessório",
      limpeza: "Limpeza",
      servico_terceirizado: "Serviço terceirizado",
      outro: "Outro",
    };
    return map[tipo] ?? tipo;
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("produtos").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir produto: " + error.message);
      return;
    }

    setDeleteTarget(null);
    await carregar();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("produtos").delete().in("id", selectedIds);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir produtos selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description="Catálogo de produtos e materiais do estoque."
        actions={
          <>
            <Link href="/inventario/produtos/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Novo Produto
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
              onChange={(e) => setBusca(e.target.value)} placeholder="Nome, categoria, unidade..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value as "ativos" | "inativos" | "todos")}>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          Mostrando <strong>{filtrados.length}</strong> de <strong>{produtos.length}</strong> produto(s).
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Selecionados: {selectedIds.length}</span>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setBulkDeleteOpen(true)}
            className="px-3 py-1.5 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Excluir selecionados
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-slate-600">Nenhum produto encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => toggleSelecionarTodosFiltrados(e.target.checked)}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Categoria</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Unidade</th>
                  <th className="py-2 pr-4">Saldo</th>
                  <th className="py-2 pr-4">Mín.</th>
                  <th className="py-2 pr-4">Máx.</th>
                  <th className="py-2 pr-4">Custo</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const saldo = saldos[p.id] ?? 0;
                  const abaixo = p.estoque_minimo !== null && saldo < p.estoque_minimo;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={(e) => toggleSelecionado(p.id, e.target.checked)}
                          aria-label={`Selecionar produto ${p.nome}`}
                        />
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/inventario/produtos/${p.id}`} className="hover:underline">{p.nome}</Link>
                        {p.destaque && <span className="ml-1 text-xs text-amber-600">(destaque)</span>}
                        {p.codigo_interno ? <div className="text-xs text-slate-500">{p.codigo_interno}</div> : null}
                      </td>
                      <td className="py-2 pr-4 text-slate-500">{p.categoria ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-500">{labelTipoItem(p.tipo_item)}</td>
                      <td className="py-2 pr-4">{p.unidade}</td>
                      <td className={`py-2 pr-4 font-semibold ${abaixo ? "text-red-600" : ""}`}>{saldo}</td>
                      <td className="py-2 pr-4 text-slate-500">{p.estoque_minimo ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-500">{p.estoque_maximo ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-500">
                        {p.preco_custo != null ? p.preco_custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2 justify-end md:justify-start">
                          <span className={`inline-flex px-2 py-1 rounded text-xs border ${p.ativo ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-600 bg-slate-50"}`}>
                            {p.ativo ? "Ativo" : "Inativo"}
                          </span>
                          {!p.controla_estoque ? (
                            <span className="inline-flex px-2 py-1 rounded text-xs border border-indigo-200 text-indigo-700 bg-indigo-50">
                              Sem estoque
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                          title="Excluir produto"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={`Deseja excluir o produto "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir produtos selecionados"
        description={`Deseja excluir ${selectedIds.length} produto(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />
    </div>
  );
}
