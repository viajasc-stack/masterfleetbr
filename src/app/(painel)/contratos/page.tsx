"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { ActionIconButton, ActionIconLink } from "@/components/ui/ActionIcon";
import { supabase } from "@/lib/supabase/client";

type Contrato = {
  id: string;
  nome: string;
  cliente_id: string;
  ativo: boolean;
  forma_cobranca: "km" | "dia" | "mensal";
  valor_cobranca: number;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
};

type ClienteMini = { id: string; nome: string };

type StatusContrato = {
  label: string;
  className: string;
};

function parseDateOnly(value: string | null) {
  if (!value) return null;
  const raw = value.slice(0, 10);
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function getStatusContrato(c: Contrato): StatusContrato {
  if (!c.ativo) {
    return {
      label: "Inativo",
      className: "border-slate-200 text-slate-700 bg-slate-50",
    };
  }

  const dataFim = parseDateOnly(c.data_fim);
  if (!dataFim) {
    return {
      label: "Ativo",
      className: "border-green-200 text-green-700 bg-green-50",
    };
  }

  const hoje = new Date();
  const hojeDateOnly = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diffMs = dataFim.getTime() - hojeDateOnly.getTime();
  const diasRestantes = Math.floor(diffMs / 86_400_000);

  if (diasRestantes < 0) {
    return {
      label: "Vencido",
      className: "border-red-200 text-red-700 bg-red-50",
    };
  }

  if (diasRestantes <= 10) {
    return {
      label: "Vencendo",
      className: "border-amber-200 text-amber-800 bg-amber-50",
    };
  }

  return {
    label: "Ativo",
    className: "border-green-200 text-green-700 bg-green-50",
  };
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Contrato | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function carregar() {
    setLoading(true);

    const { data: contratosData } = await supabase
      .from("contratos")
      .select("id, nome, cliente_id, ativo, forma_cobranca, valor_cobranca, data_inicio, data_fim, created_at")
      .order("created_at", { ascending: false });

    const { data: clientesData } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome", { ascending: true });

    const map: Record<string, string> = {};
    ((clientesData ?? []) as ClienteMini[]).forEach((c) => {
      map[c.id] = c.nome;
    });

    setClientesMap(map);
    setContratos((contratosData ?? []) as Contrato[]);
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
    if (!q) return contratos;
    return contratos.filter((c) => {
      const cliente = (clientesMap[c.cliente_id] ?? "").toLowerCase();
      return c.nome.toLowerCase().includes(q) || cliente.includes(q);
    });
  }, [busca, contratos, clientesMap]);

  async function excluirSelecionado() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("contratos").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      alert("Erro ao excluir contrato: " + error.message);
      return;
    }
    setDeleteTarget(null);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Cadastro de contratos (dados principais)."
        actions={
          <>
            <Link href="/contratos/novo" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Novo Contrato
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <label className="block text-sm font-medium mb-1">Buscar por contrato/cliente</label>
        <input
          className="w-full md:w-[420px] border border-slate-300 rounded-md px-3 py-2"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite para filtrar..."
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-slate-600">Nenhum contrato encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Contrato</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Cobrança</th>
                  <th className="py-2 pr-4">Vigência</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const status = getStatusContrato(c);
                  return (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-slate-50 transition">
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/contratos/${c.id}`} className="hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{clientesMap[c.cliente_id] ?? "—"}</td>
                    <td className="py-2 pr-4">{c.forma_cobranca} • R$ {Number(c.valor_cobranca ?? 0).toFixed(2)}</td>
                    <td className="py-2 pr-4">
                      {(c.data_inicio || "—") + " até " + (c.data_fim || "—")}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        <ActionIconLink href={`/contratos/${c.id}`} title="Editar contrato" variant="primary">
                          ✏️
                        </ActionIconLink>
                        <ActionIconButton title="Excluir contrato" variant="danger" onClick={() => setDeleteTarget(c)}>
                          🗑️
                        </ActionIconButton>
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        description={`Deseja excluir o contrato "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />
    </div>
  );
}
