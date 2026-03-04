"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Movimento = {
  id: string;
  tipo: string;
  quantidade: number;
  origem: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  entrada_id: string | null;
  manutencao_id: string | null;
  ordem_servico_id: string | null;
  veiculo_id: string | null;
  created_at: string;
  produtos: { nome: string; unidade: string } | null;
  depositos: { nome: string } | null;
};

export default function MovimentosPage() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Movimento | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("movimentos_estoque")
      .select("id, tipo, quantidade, origem, valor_unitario, valor_total, entrada_id, manutencao_id, ordem_servico_id, veiculo_id, created_at, produtos(nome, unidade), depositos(nome)")
      .order("created_at", { ascending: false })
      .limit(200);
    setTimeout(() => {
      setMovimentos((data as unknown as Movimento[]) ?? []);
      setSelectedIds((prev) => prev.filter((id) => (data as Movimento[] | null)?.some((m) => m.id === id)));
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

  const allFilteredSelected =
    filtrados.length > 0 && filtrados.every((m) => selectedIds.includes(m.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...filtrados.map((m) => m.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !filtrados.some((m) => m.id === id)));
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("movimentos_estoque").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir movimento: " + error.message);
      return;
    }

    setDeleteTarget(null);
    await carregar();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("movimentos_estoque").delete().in("id", selectedIds);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir movimentos selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregar();
  }

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
          <div className="text-slate-600">Nenhum movimento encontrado.</div>
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
                  <th className="py-2 pr-4">Data/Hora</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Quantidade</th>
                  <th className="py-2 pr-4">Valor Total</th>
                  <th className="py-2 pr-4">Depósito</th>
                  <th className="py-2">Origem</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(m.id)}
                        onChange={(e) => toggleSelecionado(m.id, e.target.checked)}
                        aria-label={`Selecionar movimento ${m.id}`}
                      />
                    </td>
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
                    <td className="py-2 pr-4">
                      {m.valor_total != null
                        ? m.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{m.depositos?.nome ?? "—"}</td>
                    <td className="py-2 text-slate-500">
                      <div className="flex flex-col">
                        <span>{m.origem ?? "—"}</span>
                        <span className="text-xs text-slate-400">
                          {m.entrada_id ? `Entrada: ${m.entrada_id.slice(0, 8)}` : null}
                          {m.ordem_servico_id ? ` OS: ${m.ordem_servico_id.slice(0, 8)}` : null}
                          {m.manutencao_id ? ` Manut.: ${m.manutencao_id.slice(0, 8)}` : null}
                          {m.veiculo_id ? ` Veículo: ${m.veiculo_id.slice(0, 8)}` : null}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(m)}
                        className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                        title="Excluir movimento"
                      >
                        🗑
                      </button>
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
        description={`Deseja excluir este movimento de estoque?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir movimentos selecionados"
        description={`Deseja excluir ${selectedIds.length} movimento(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />

      <Link href="/inventario" className="text-sm text-slate-400 hover:text-white">← Voltar ao Inventário</Link>
    </div>
  );
}
