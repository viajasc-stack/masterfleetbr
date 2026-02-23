"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("ativos");

  async function carregarClientes() {
    setLoading(true);

    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome, tipo, email, telefone, whatsapp, ativo, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setClientes(data);
    } else {
      setClientes([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return clientes
      .filter((c) => {
        if (filtroAtivo === "ativos") return c.ativo === true;
        if (filtroAtivo === "inativos") return c.ativo === false;
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
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
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
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
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
                          c.ativo
                            ? "border-green-200 text-green-700 bg-green-50"
                            : "border-slate-200 text-slate-700 bg-slate-50"
                        }`}
                      >
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="py-2 pr-0">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}