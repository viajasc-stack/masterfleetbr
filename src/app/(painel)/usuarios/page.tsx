"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Usuario = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  status: string;
  created_at: string;
};

type FiltroStatus = "ativo" | "ferias" | "afastado" | "inativo" | "todos";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");

  async function carregarUsuarios() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, cpf, email, telefone, whatsapp, status, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setUsuarios(data as Usuario[]);
      setSelectedIds((prev) => prev.filter((id) => (data as Usuario[]).some((u) => u.id === id)));
      setLoadError("");
    } else {
      setUsuarios([]);
      setLoadError(error?.message ?? "Não foi possível carregar os usuários.");
    }

    setLoading(false);
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return usuarios
      .filter((u) => {
        if (filtroStatus === "todos") return true;
        return (u.status || "").toLowerCase() === filtroStatus;
      })
      .filter((u) => {
        if (!q) return true;

        const alvo = [
          u.nome,
          u.cpf ?? "",
          u.email ?? "",
          u.telefone ?? "",
          u.whatsapp ?? "",
          u.status ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [usuarios, busca, filtroStatus]);

  const allFilteredSelected =
    usuariosFiltrados.length > 0 && usuariosFiltrados.every((u) => selectedIds.includes(u.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...usuariosFiltrados.map((u) => u.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !usuariosFiltrados.some((u) => u.id === id)));
  }

  function badgeStatus(status: string) {
    const s = (status || "").toLowerCase();

    if (s === "ativo") return "border-green-200 text-green-700 bg-green-50";
    if (s === "ferias") return "border-blue-200 text-blue-800 bg-blue-50";
    if (s === "afastado") return "border-amber-200 text-amber-800 bg-amber-50";
    return "border-slate-200 text-slate-700 bg-slate-50";
  }

  function labelStatus(status: string) {
    const s = (status || "").toLowerCase();
    if (s === "ferias") return "Férias";
    if (s === "afastado") return "Afastado";
    if (s === "inativo") return "Inativo";
    return "Ativo";
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setDeleting(false);
      alert("Sessão inválida. Faça login novamente.");
      return;
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-usuario`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ usuario_id: deleteTarget.id }),
    });

    const result = await response.json();
    setDeleting(false);

    if (!response.ok || !result?.ok) {
      alert("Erro ao excluir usuário: " + (result?.error ?? "erro desconhecido"));
      return;
    }

    setDeleteTarget(null);
    await carregarUsuarios();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setDeleting(false);
      alert("Sessão inválida. Faça login novamente.");
      return;
    }

    for (const usuarioId of selectedIds) {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-usuario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ usuario_id: usuarioId }),
      });

      const result = await response.json();
      if (!response.ok || !result?.ok) {
        setDeleting(false);
        alert("Erro ao excluir usuários selecionados: " + (result?.error ?? "erro desconhecido"));
        return;
      }
    }

    setDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregarUsuarios();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Cadastre e gerencie os usuários com acesso ao sistema web."
        actions={
          <>
            <Link
              href="/usuarios/novo"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Novo Usuário
            </Link>

            <button
              onClick={carregarUsuarios}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Recarregar
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loadError ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Erro ao carregar usuários: {loadError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, CPF, e-mail, telefone..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            >
              <option value="ativo">Ativo</option>
              <option value="ferias">Férias</option>
              <option value="afastado">Afastado</option>
              <option value="inativo">Inativo</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          Mostrando <span className="font-semibold">{usuariosFiltrados.length}</span> de{" "}
          <span className="font-semibold">{usuarios.length}</span> usuário(s).
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
        ) : usuariosFiltrados.length === 0 ? (
          <div className="text-slate-600">Nenhum usuário encontrado com esses filtros.</div>
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
                  <th className="py-2 pr-4">CPF</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(u.id)}
                        onChange={(e) => toggleSelecionado(u.id, e.target.checked)}
                        aria-label={`Selecionar usuário ${u.nome}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/usuarios/${u.id}`} className="hover:underline">
                        {u.nome}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{u.cpf ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-col">
                        <span>{u.email ?? "—"}</span>
                        <span className="text-slate-500">{u.telefone ?? u.whatsapp ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${badgeStatus(
                          u.status
                        )}`}
                      >
                        {labelStatus(u.status)}
                      </span>
                    </td>
                    <td className="py-2 pr-0">{new Date(u.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-0 text-right space-x-2">
                      <Link
                        href={`/usuarios/${u.id}`}
                        className="inline-block px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50"
                        title="Editar usuário"
                      >
                        ✏️
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(u)}
                        className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                        title="Excluir usuário"
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
        description={`Deseja excluir o usuário "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir usuários selecionados"
        description={`Deseja excluir ${selectedIds.length} usuário(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />
    </div>
  );
}
