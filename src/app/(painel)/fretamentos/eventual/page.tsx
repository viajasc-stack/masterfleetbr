"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { supabase } from "@/lib/supabase/client";

type FretamentoRow = {
  id: string;
  status: "pendente" | "em_execucao" | "concluida" | "cancelada";
  cliente_id: string | null;
  destino: string | null;
  inicio_em: string | null;
  fim_em: string | null;
  created_at: string;
  clientes?: { nome: string }[] | { nome: string } | null;
};

type Cliente = { id: string; nome: string };
type StatusFiltro = "pendente" | "em_execucao" | "concluida" | "cancelada" | "todos";

function formatDataHora(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

function statusLabel(status: StatusFiltro | FretamentoRow["status"]) {
  if (status === "pendente") return "Pendente";
  if (status === "em_execucao") return "Em execução";
  if (status === "concluida") return "Concluída";
  if (status === "cancelada") return "Cancelada";
  return "Todos";
}

function clienteNome(row: FretamentoRow) {
  if (!row.clientes) return "—";
  if (Array.isArray(row.clientes)) return row.clientes[0]?.nome ?? "—";
  return row.clientes.nome ?? "—";
}

export default function FretamentoEventualPage() {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<FretamentoRow[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<StatusFiltro>("pendente");
  const [clienteId, setClienteId] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<FretamentoRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    setLoading(true);

    const { data: osData } = await supabase
      .from("ordens_servico")
      .select("id, status, cliente_id, destino, inicio_em, fim_em, created_at, clientes:cliente_id(nome)")
      .eq("tipo", "eventual");

    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome", { ascending: true });

    setLista((osData ?? []) as FretamentoRow[]);
    setClientes((clientesData ?? []) as Cliente[]);
    setLoading(false);
  }

  useEffect(() => {
    void carregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    let base = lista.filter((i) => {
      if (status !== "todos" && i.status !== status) return false;
      if (clienteId && i.cliente_id !== clienteId) return false;

      if (periodoInicio || periodoFim) {
        const dt = i.inicio_em ? new Date(i.inicio_em) : null;
        if (!dt) return false;

        if (periodoInicio) {
          const ini = new Date(`${periodoInicio}T00:00:00`);
          if (dt < ini) return false;
        }
        if (periodoFim) {
          const fim = new Date(`${periodoFim}T23:59:59`);
          if (dt > fim) return false;
        }
      }

      if (!q) return true;
      return [
        clienteNome(i),
        i.destino ?? "",
        i.status ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const asc = status === "pendente";
    base = [...base].sort((a, b) => {
      const da = new Date(a.inicio_em ?? a.created_at).getTime();
      const db = new Date(b.inicio_em ?? b.created_at).getTime();
      return asc ? da - db : db - da;
    });

    return base;
  }, [lista, busca, status, clienteId, periodoInicio, periodoFim]);

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("ordens_servico").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      alert("Erro ao excluir fretamento: " + error.message);
      return;
    }
    setDeleteTarget(null);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fretamentos • Eventual"
        description="Listagem de fretamentos do tipo eventual."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/fretamentos/eventual/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Novo Fretamento
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </div>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Busca</label>
          <input
            className="w-full border border-slate-300 rounded-md px-3 py-2"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente, destino..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as StatusFiltro)}>
            <option value="pendente">{statusLabel("pendente")}</option>
            <option value="em_execucao">{statusLabel("em_execucao")}</option>
            <option value="concluida">{statusLabel("concluida")}</option>
            <option value="cancelada">{statusLabel("cancelada")}</option>
            <option value="todos">{statusLabel("todos")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cliente</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Período inicial</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Período final</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-slate-600">Nenhum fretamento eventual encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Destino</th>
                  <th className="py-2 pr-4">Data início</th>
                  <th className="py-2 pr-4">Data fim</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                    <td className="py-2 pr-4">{clienteNome(item)}</td>
                    <td className="py-2 pr-4">{item.destino ?? "—"}</td>
                    <td className="py-2 pr-4">{formatDataHora(item.inicio_em)}</td>
                    <td className="py-2 pr-4">{formatDataHora(item.fim_em)}</td>
                    <td className="py-2 pr-4">{statusLabel(item.status)}</td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link href={`/ordens-servico/${item.id}`} className="px-2 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50" title="Visualizar">👁️</Link>
                        <Link href={`/ordens-servico/${item.id}`} className="px-2 py-1 text-xs border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50" title="Editar">✏️</Link>
                        <button type="button" onClick={() => setDeleteTarget(item)} className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50" title="Excluir">🗑</button>
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
        description={`Deseja excluir este fretamento eventual?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />
    </div>
  );
}