"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type Veiculo = {
  id: string;
  placa: string;
  prefixo: string | null;
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
  ano_modelo: number | null;
  capacidade_passageiros: number | null;
  status: string;
  km_atual: number | null;
  created_at: string;
};

type FiltroStatus = "ativo" | "manutencao" | "inativo" | "todos";

export default function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Veiculo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativo");

  async function carregarEmpresaId() {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setStatusMsg("❌ Você não está logado. Faça login para ver seus veículos.");
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

  async function carregarVeiculos() {
    setLoading(true);
    setStatusMsg("");

    const empresaId = await carregarEmpresaId();
    if (!empresaId) {
      setVeiculos([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("veiculos")
      .select(
        "id, placa, prefixo, tipo, marca, modelo, ano_modelo, capacidade_passageiros, status, km_atual, created_at"
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    setTimeout(() => {
      if (!error && data) {
        setVeiculos(data as Veiculo[]);
        setSelectedIds((prev) => prev.filter((id) => (data as Veiculo[]).some((v) => v.id === id)));
      } else {
        setVeiculos([]);
        setStatusMsg(error ? `❌ Erro ao carregar veículos: ${error.message}` : "");
      }
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarVeiculos(); }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const veiculosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return veiculos
      .filter((v) => {
        if (filtroStatus === "todos") return true;
        return (v.status || "").toLowerCase() === filtroStatus;
      })
      .filter((v) => {
        if (!q) return true;

        const alvo = [
          v.placa,
          v.prefixo ?? "",
          v.tipo ?? "",
          v.marca ?? "",
          v.modelo ?? "",
          v.status ?? "",
          v.ano_modelo ? String(v.ano_modelo) : "",
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [veiculos, busca, filtroStatus]);

  const allFilteredSelected =
    veiculosFiltrados.length > 0 && veiculosFiltrados.every((v) => selectedIds.includes(v.id));

  function toggleSelecionado(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelecionarTodosFiltrados(checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...new Set([...prev, ...veiculosFiltrados.map((v) => v.id)])]);
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !veiculosFiltrados.some((v) => v.id === id)));
  }

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("veiculos").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir veículo: " + error.message);
      return;
    }

    setDeleteTarget(null);
    await carregarVeiculos();
  }

  async function excluirSelecionadosEmLote() {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    const { error } = await supabase.from("veiculos").delete().in("id", selectedIds);
    setDeleting(false);

    if (error) {
      alert("Erro ao excluir veículos selecionados: " + error.message);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedIds([]);
    await carregarVeiculos();
  }

  async function compartilhar(v: Veiculo) {
    const { data, error } = await supabase
      .from("veiculos")
      .select("codigo_acesso")
      .eq("id", v.id)
      .single();

    if (error) {
      alert("Erro ao preparar compartilhamento: " + error.message);
      return;
    }

    const codigo = (data as { codigo_acesso?: string | null })?.codigo_acesso;
    if (!codigo) {
      alert("Veículo sem código de compartilhamento. Aplique as migrations mais recentes.");
      return;
    }

    const link = `${window.location.origin}/veiculo/${v.id}?codigo=${codigo}`;

    try {
      await navigator.clipboard.writeText(link);
      alert("Link de compartilhamento copiado com sucesso.");
    } catch {
      prompt("Copie o link para enviar ao cliente:", link);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos"
        description="Cadastre e gerencie sua frota."
        actions={
          <>
            <Link
              href="/veiculos/novo"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Novo Veículo
            </Link>

            <button
              onClick={carregarVeiculos}
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
              placeholder="Placa, marca, modelo, tipo..."
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
              <option value="manutencao">Manutenção</option>
              <option value="inativo">Inativo</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          Mostrando <span className="font-semibold">{veiculosFiltrados.length}</span>{" "}
          de <span className="font-semibold">{veiculos.length}</span> veículo(s).
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
        ) : veiculosFiltrados.length === 0 ? (
          <div className="text-slate-600">
            Nenhum veículo encontrado com esses filtros.
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
                  <th className="py-2 pr-4">Placa</th>
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Capacidade</th>
                  <th className="py-2 pr-4">KM</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {veiculosFiltrados.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(v.id)}
                        onChange={(e) => toggleSelecionado(v.id, e.target.checked)}
                        aria-label={`Selecionar veículo ${v.placa}`}
                      />
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      <div className="flex flex-col">
                        <Link
                          href={`/veiculos/${v.id}`}
                          className="hover:underline"
                        >
                          {v.placa}
                        </Link>
                        {v.prefixo ? (
                          <span className="text-xs text-slate-500">Prefixo: {v.prefixo}</span>
                        ) : null}
                      </div>
                    </td>

                    <td className="py-2 pr-4">
                      {(v.marca || v.modelo || v.tipo) ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {[v.marca, v.modelo].filter(Boolean).join(" ")}
                          </span>
                          <span className="text-slate-500">
                            {[v.tipo, v.ano_modelo ? String(v.ano_modelo) : ""]
                              .filter(Boolean)
                              .join(" • ")}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="py-2 pr-4">
                      {typeof v.capacidade_passageiros === "number"
                        ? `${v.capacidade_passageiros} pax`
                        : "—"}
                    </td>

                    <td className="py-2 pr-4">
                      {typeof v.km_atual === "number" ? v.km_atual : "—"}
                    </td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${
                          v.status === "ativo"
                            ? "border-green-200 text-green-700 bg-green-50"
                            : v.status === "manutencao"
                            ? "border-amber-200 text-amber-800 bg-amber-50"
                            : "border-slate-200 text-slate-700 bg-slate-50"
                        }`}
                      >
                        {v.status === "manutencao"
                          ? "Manutenção"
                          : v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                      </span>
                    </td>

                    <td className="py-2 pr-0">
                      {new Date(v.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => compartilhar(v)}
                          className="px-2 py-1 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                          title="Compartilhar veículo"
                        >
                          🔗
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(v)}
                          className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                          title="Excluir veículo"
                        >
                          🗑
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
        description={`Deseja excluir o veículo "${deleteTarget?.placa ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />

      <DeleteConfirmDialog
        open={bulkDeleteOpen}
        title="Excluir veículos selecionados"
        description={`Deseja excluir ${selectedIds.length} veículo(s) selecionado(s)?`}
        loading={deleting}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={excluirSelecionadosEmLote}
      />
    </div>
  );
}
