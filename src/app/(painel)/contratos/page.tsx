"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
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
                {filtrados.map((c) => (
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
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${c.ativo ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-700 bg-slate-50"}`}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link href={`/contratos/${c.id}`} className="px-2 py-1 text-xs border border-slate-300 rounded-md hover:bg-slate-50">
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                        >
                          Excluir
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
        description={`Deseja excluir o contrato "${deleteTarget?.nome ?? ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={excluirSelecionado}
      />
    </div>
  );
}
