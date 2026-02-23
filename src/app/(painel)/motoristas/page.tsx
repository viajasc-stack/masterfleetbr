"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Motorista = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  status: string;
  created_at: string;
};

type FiltroStatus = "ativo" | "ferias" | "afastado" | "inativo" | "todos";

export default function MotoristasPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativo");

  async function carregarMotoristas() {
    setLoading(true);

    const { data, error } = await supabase
      .from("motoristas")
      .select("id, nome, cpf, telefone, whatsapp, status, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) setMotoristas(data as Motorista[]);
    else setMotoristas([]);

    setLoading(false);
  }

  useEffect(() => {
    carregarMotoristas();
  }, []);

  const motoristasFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return motoristas
      .filter((m) => {
        if (filtroStatus === "todos") return true;
        return (m.status || "").toLowerCase() === filtroStatus;
      })
      .filter((m) => {
        if (!q) return true;

        const alvo = [
          m.nome,
          m.cpf ?? "",
          m.telefone ?? "",
          m.whatsapp ?? "",
          m.status ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [motoristas, busca, filtroStatus]);

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
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">CPF</th>
                  <th className="py-2 pr-4">Contato</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {motoristasFiltrados.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
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
                          m.status
                        )}`}
                      >
                        {labelStatus(m.status)}
                      </span>
                    </td>

                    <td className="py-2 pr-0">
                      {new Date(m.created_at).toLocaleString("pt-BR")}
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