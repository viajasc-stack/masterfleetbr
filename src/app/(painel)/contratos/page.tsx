"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Contrato = {
  id: string;
  nome: string;
  descricao: string | null;
  dias_semana: number[];
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  created_at: string;
  cliente_id: string;
};

type ClienteMini = {
  id: string;
  nome: string;
};

type HorarioMini = {
  id: string;
  contrato_id: string;
};

type FiltroAtivo = "ativos" | "inativos" | "todos";

const DIAS_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

function formatDias(dias: number[] | null | undefined) {
  if (!dias || dias.length === 0) return "—";
  const sorted = [...dias].sort((a, b) => a - b);
  return sorted.map((d) => DIAS_LABEL[d] ?? String(d)).join(", ");
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [horariosCountMap, setHorariosCountMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>("ativos");

  async function carregarContratos() {
    setLoading(true);

    const { data: contratosData, error: contratosErr } = await supabase
      .from("contratos")
      .select("id, nome, descricao, dias_semana, data_inicio, data_fim, ativo, created_at, cliente_id")
      .order("created_at", { ascending: false });

    if (contratosErr || !contratosData) {
      console.error(contratosErr);
      setContratos([]);
      setClientesMap({});
      setHorariosCountMap({});
      setLoading(false);
      return;
    }

    setTimeout(() => {
      setContratos(contratosData as Contrato[]);
    }, 0);

    // Carrega clientes (para exibir nome)
    const { data: clientesData, error: clientesErr } = await supabase
      .from("clientes")
      .select("id, nome")
      .order("nome", { ascending: true });

    setTimeout(() => {
      if (!clientesErr && clientesData) {
        const map: Record<string, string> = {};
        (clientesData as ClienteMini[]).forEach((c) => (map[c.id] = c.nome));
        setClientesMap(map);
      } else {
        setClientesMap({});
      }
    }, 0);

    // Conta horários por contrato (para exibir quantidade)
    const { data: horariosData, error: horariosErr } = await supabase
      .from("contrato_horarios")
      .select("id, contrato_id");

    setTimeout(() => {
      if (!horariosErr && horariosData) {
        const count: Record<string, number> = {};
        (horariosData as HorarioMini[]).forEach((h) => {
          count[h.contrato_id] = (count[h.contrato_id] ?? 0) + 1;
        });
        setHorariosCountMap(count);
      } else {
        setHorariosCountMap({});
      }
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregarContratos(); }, 0);
    return () => clearTimeout(id);
  }, []);

  const contratosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return contratos
      .filter((c) => {
        if (filtroAtivo === "ativos") return c.ativo === true;
        if (filtroAtivo === "inativos") return c.ativo === false;
        return true;
      })
      .filter((c) => {
        if (!q) return true;

        const clienteNome = clientesMap[c.cliente_id] ?? "";
        const alvo = [
          c.nome,
          c.descricao ?? "",
          clienteNome,
          formatDias(c.dias_semana),
          c.data_inicio ?? "",
          c.data_fim ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [contratos, busca, filtroAtivo, clientesMap]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contratos"
        description="Gerencie contratos recorrentes (dias + múltiplos horários com observação por saída)."
        actions={
          <>
            <Link
              href="/contratos/novo"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Novo Contrato
            </Link>

            <button
              onClick={carregarContratos}
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
              placeholder="Contrato, cliente, dias, vigência..."
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
          Mostrando <span className="font-semibold">{contratosFiltrados.length}</span>{" "}
          de <span className="font-semibold">{contratos.length}</span> contrato(s).
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : contratosFiltrados.length === 0 ? (
          <div className="text-slate-600">Nenhum contrato encontrado com esses filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Contrato</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Dias</th>
                  <th className="py-2 pr-4">Horários</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-0">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {contratosFiltrados.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/contratos/${c.id}`} className="hover:underline">
                        {c.nome}
                      </Link>
                      {c.descricao ? (
                        <div className="text-xs text-slate-500">{c.descricao}</div>
                      ) : null}
                    </td>

                    <td className="py-2 pr-4">
                      {clientesMap[c.cliente_id] ?? "—"}
                    </td>

                    <td className="py-2 pr-4">{formatDias(c.dias_semana)}</td>

                    <td className="py-2 pr-4">
                      <span className="text-slate-700">
                        {horariosCountMap[c.id] ?? 0}
                      </span>
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
