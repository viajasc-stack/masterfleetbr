"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Motorista = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  status: string | null;
  ativo?: boolean | null;
  created_at: string;
};

type FiltroStatus = "ativo" | "ferias" | "afastado" | "inativo" | "todos";

export default function MotoristasPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Motorista | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativo");

  function getStatusNormalizado(m: Pick<Motorista, "status" | "ativo">) {
    const status = String(m.status ?? "").toLowerCase().trim();
    if (status) return status;
    if (m.ativo === false) return "inativo";
    return "ativo";
  }

  async function carregarEmpresaId() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setStatusMsg("❌ Você não está logado. Faça login para ver seus motoristas.");
      return null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error || !profile?.empresa_id) {
      setStatusMsg("⚠️ Não foi possível identificar sua empresa.");
      return null;
    }

    return profile.empresa_id as string;
  }

  async function carregarMotoristas() {
    setLoading(true);
    setStatusMsg("");

    const empresaId = await carregarEmpresaId();
    if (!empresaId) {
      setMotoristas([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("motoristas")
      .select("id, nome, cpf, telefone, whatsapp, status, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    // Compatibilidade com schema legado (sem coluna status)
    if (error && /column .*status.* does not exist/i.test(error.message)) {
      const legacy = await supabase
        .from("motoristas")
        .select("id, nome, cpf, telefone, whatsapp, ativo, created_at")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });

      setTimeout(() => {
        if (!legacy.error && legacy.data) {
          const normalizados = (legacy.data as Motorista[]).map((m) => ({
            ...m,
            status: m.ativo === false ? "inativo" : "ativo",
          }));
          setMotoristas(normalizados);
          setStatusMsg("");
        } else {
          setMotoristas([]);
          setStatusMsg(
            legacy.error ? `❌ Erro ao carregar motoristas: ${legacy.error.message}` : ""
          );
        }
        setLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      if (!error && data) {
        setMotoristas(data as Motorista[]);
        setSelectedIds((prev) => prev.filter((id) => (data as Motorista[]).some((m) => m.id === id)));
        setStatusMsg("");
      } else {
        setMotoristas([]);
        setStatusMsg(error ? `❌ Erro ao carregar motoristas: ${error.message}` : "");
      }
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarMotoristas(); }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const motoristasFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return motoristas
      .filter((m) => {
        if (filtroStatus === "todos") return true;
        return getStatusNormalizado(m) === filtroStatus;
      })
      .filter((m) => {
        if (!q) return true;

        const alvo = [
          m.nome,
          m.cpf ?? "",
          m.telefone ?? "",
          m.whatsapp ?? "",
          getStatusNormalizado(m),
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [motoristas, busca, filtroStatus]);

  const allFilteredSelected =
    motoristasFiltrados.length > 0 && motoristasFiltrados.every((m) => selectedIds.includes(m.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...motoristasFiltrados.map((m) => m.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !motoristasFiltrados.some((m) => m.id === id)));
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
    const { error } = await supabase.from("motoristas").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir motorista: " + error.message);
      return;
    }

    setDeleteTarget(null);
    await carregarMotoristas();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("motoristas").delete().in("id", selectedIds);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir motoristas selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregarMotoristas();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas"
        description="Cadastre e gerencie seus motoristas."
        actions={
          <>
            <Link
              href="/motoristas/novo"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Novo Motorista
            </Link>

            <button
              onClick={carregarMotoristas}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Recarregar
            </button>
          </>
        }
      />

      {statusMsg ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
          {statusMsg}
        </div>
      ) : null}

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, CPF, telefone, WhatsApp..."
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
          Mostrando{" "}
          <span className="font-semibold">{motoristasFiltrados.length}</span> de{" "}
          <span className="font-semibold">{motoristas.length}</span> motorista(s).
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
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : motoristasFiltrados.length === 0 ? (
          <div className="text-slate-600">
            Nenhum motorista encontrado com esses filtros.
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
                  <th className="py-2 pr-4">CPF</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {motoristasFiltrados.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(m.id)}
                        onChange={(e) => toggleSelecionado(m.id, e.target.checked)}
                        aria-label={`Selecionar motorista ${m.nome}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/motoristas/${m.id}`}
                        className="hover:underline"
                      >
                        {m.nome}
                      </Link>
                    </td>

                    <td className="py-2 pr-4">{m.cpf ?? "—"}</td>

                    <td className="py-2 pr-4">
                      <div className="flex flex-col">
                        <span>{m.telefone ?? "—"}</span>
                        <span className="text-slate-500">
                          {m.whatsapp ?? "—"}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${badgeStatus(
                          getStatusNormalizado(m)
                        )}`}
                      >
                        {labelStatus(getStatusNormalizado(m))}
                      </span>
                    </td>

                    <td className="py-2 pr-0">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(m)}
                        className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                        title="Excluir motorista"
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
        description={`Deseja excluir o motorista "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir motoristas selecionados"
        description={`Deseja excluir ${selectedIds.length} motorista(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />
    </div>
  );
}
