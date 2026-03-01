"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Veiculo = {
  id: string;
  placa: string;
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

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativo");

  async function carregarVeiculos() {
    setLoading(true);

    const { data, error } = await supabase
      .from("veiculos")
      .select(
        "id, placa, tipo, marca, modelo, ano_modelo, capacidade_passageiros, status, km_atual, created_at"
      )
      .order("created_at", { ascending: false });

    setTimeout(() => {
      if (!error && data) setVeiculos(data as Veiculo[]);
      else setVeiculos([]);
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarVeiculos(); }, 0);
    return () => clearTimeout(id);
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
                  <th className="py-2 pr-4">Placa</th>
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Capacidade</th>
                  <th className="py-2 pr-4">KM</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {veiculosFiltrados.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/veiculos/${v.id}`}
                        className="hover:underline"
                      >
                        {v.placa}
                      </Link>
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
