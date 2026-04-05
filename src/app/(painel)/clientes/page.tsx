"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { ActionIconButton } from "@/components/ui/ActionIcon";

type Cliente = {
  id: string;
  nome: string;
  tipo: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  ativo: boolean;
  created_at: string;
};

type FiltroAtivo = "ativos" | "inativos" | "todos";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string>("");

  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("todos");
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  async function carregarClientes() {
    setLoading(true);
    setErro("");

    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome, tipo, email, telefone, whatsapp, ativo, created_at")
      .order("created_at", { ascending: false });
    setTimeout(() => {
      if (!error && data) {
        setClientes(data as Cliente[]);
        setSelectedIds((prev) => prev.filter((id) => (data as Cliente[]).some((c) => c.id === id)));
      } else {
        setClientes([]);
        setErro(error?.message ?? "Falha ao carregar clientes.");
      }
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    let mounted = true;

    const id = setTimeout(() => {
      void carregarClientes();
    }, 0);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) void carregarClientes();
    });

    return () => {
      mounted = false;
      clearTimeout(id);
      sub.subscription.unsubscribe();
    };
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return clientes
      .filter((c) => {
        const ativoNormalizado = c.ativo !== false;
        if (filtroAtivo === "ativos") return ativoNormalizado;
        if (filtroAtivo === "inativos") return !ativoNormalizado;
        return true;
      })
      .filter((c) => {
        if (!q) return true;

        const alvo = [
          c.nome,
          c.email ?? "",
          c.telefone ?? "",
          c.whatsapp ?? "",
          c.tipo ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [clientes, busca, filtroAtivo]);

  const allFilteredSelected =
    clientesFiltrados.length > 0 && clientesFiltrados.every((c) => selectedIds.includes(c.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...clientesFiltrados.map((c) => c.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !clientesFiltrados.some((c) => c.id === id)));
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("clientes").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir cliente: " + error.message);
      return;
    }

    setDeleteTarget(null);
    await carregarClientes();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("clientes").delete().in("id", selectedIds);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir clientes selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregarClientes();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gerencie seus clientes cadastrados."
        actions={
          <>
            <Link
              href="/clientes/novo"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Novo Cliente
            </Link>

            <button
              onClick={carregarClientes}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Recarregar
            </button>
          </>
        }
      />

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, email, telefone ou WhatsApp..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value as FiltroAtivo)}
            >
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          Mostrando <span className="font-semibold">{clientesFiltrados.length}</span>{" "}
          de <span className="font-semibold">{clientes.length}</span> cliente(s).
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

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {erro ? (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            Erro ao carregar clientes: {erro}
          </div>
        ) : null}

        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="text-slate-600">
            Nenhum cliente encontrado com esses filtros.
          </div>
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
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={(e) => toggleSelecionado(c.id, e.target.checked)}
                        aria-label={`Selecionar cliente ${c.nome}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="hover:underline"
                      >
                        {c.nome}
                      </Link>
                    </td>

                    <td className="py-2 pr-4">{c.tipo}</td>

                    <td className="py-2 pr-4">
                      <div className="flex flex-col">
                        <span>{c.email ?? "—"}</span>
                        <span className="text-slate-500">
                          {c.telefone ?? c.whatsapp ?? "—"}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${
                          c.ativo !== false
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-slate-200 text-slate-700 bg-slate-50"
                        }`}
                      >
                        {c.ativo !== false ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="py-2 pr-0">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <ActionIconButton title="Excluir cliente" variant="danger" onClick={() => setDeleteTarget(c)}>
                        🗑️
                      </ActionIconButton>
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
        description={`Deseja excluir o cliente "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir clientes selecionados"
        description={`Deseja excluir ${selectedIds.length} cliente(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />
    </div>
  );
}
