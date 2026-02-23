"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OsRow = {
  id: string;
  numero: number | null;
  tipo: string;
  status: string;

  inicio_em: string | null;
  fim_em: string | null;

  origem: string | null;
  destino: string | null;

  valor_total: number | null;
  status_pagamento: string | null;

  cliente_id: string | null;
  veiculo_id: string | null;
  motorista_id: string | null;

  created_at: string;

  clientes?: { nome: string } | null;
  veiculos?: { placa: string } | null;
  motoristas?: { nome: string } | null;
};

type FiltroStatus =
  | "rascunho"
  | "aguardando_aprovacao"
  | "aprovada"
  | "em_execucao"
  | "concluida"
  | "cancelada"
  | "todas";

function formatNumeroOS(numero: number | null, createdAt: string) {
  if (!numero) return "Sem número";

  const ano = new Date(createdAt).getFullYear();
  const seq = String(numero).padStart(4, "0");

  return `OS-${ano}-${seq}`;
}

export default function OrdensServicoPage() {
  const [osList, setOsList] = useState<OsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");

  async function carregarOS() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ordens_servico")
      .select(
        `
        id, numero, tipo, status, inicio_em, fim_em, origem, destino,
        valor_total, status_pagamento, cliente_id, veiculo_id, motorista_id, created_at,
        clientes:cliente_id ( nome ),
        veiculos:veiculo_id ( placa ),
        motoristas:motorista_id ( nome )
      `
      )
      .order("created_at", { ascending: false });

    if (!error && data) setOsList(data as OsRow[]);
    else setOsList([]);

    setLoading(false);
  }

  useEffect(() => {
    carregarOS();
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return osList
      .filter((o) => {
        if (filtroStatus === "todas") return true;
        return (o.status || "").toLowerCase() === filtroStatus;
      })
      .filter((o) => {
        if (!q) return true;

        const alvo = [
          o.numero ? String(o.numero) : "",
          o.tipo ?? "",
          o.status ?? "",
          o.origem ?? "",
          o.destino ?? "",
          o.clientes?.nome ?? "",
          o.veiculos?.placa ?? "",
          o.motoristas?.nome ?? "",
          o.status_pagamento ?? "",
        ]
          .join(" ")
          .toLowerCase();

        return alvo.includes(q);
      });
  }, [osList, busca, filtroStatus]);

  function badgeStatus(status: string) {
    const s = (status || "").toLowerCase();
    if (s === "rascunho") return "border-slate-200 text-slate-700 bg-slate-50";
    if (s === "aguardando_aprovacao")
      return "border-amber-200 text-amber-800 bg-amber-50";
    if (s === "aprovada") return "border-blue-200 text-blue-800 bg-blue-50";
    if (s === "em_execucao")
      return "border-indigo-200 text-indigo-800 bg-indigo-50";
    if (s === "concluida") return "border-green-200 text-green-700 bg-green-50";
    return "border-red-200 text-red-700 bg-red-50";
  }

  function labelStatus(status: string) {
    const s = (status || "").toLowerCase();
    if (s === "rascunho") return "Rascunho";
    if (s === "aguardando_aprovacao") return "Aguardando aprovação";
    if (s === "aprovada") return "Aprovada";
    if (s === "em_execucao") return "Em execução";
    if (s === "concluida") return "Concluída";
    if (s === "cancelada") return "Cancelada";
    return status || "—";
  }

  function labelPagamento(status: string | null) {
    const s = (status || "").toLowerCase();
    if (s === "pago") return "Pago";
    if (s === "parcial") return "Parcial";
    if (s === "cancelado") return "Cancelado";
    return "Pendente";
  }

  function formatMoney(v: number | null) {
    const n = typeof v === "number" ? v : 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Serviço"
        description="Crie, gerencie e acompanhe suas OS."
        actions={
          <>
            <Link
              href="/ordens-servico/nova"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              + Nova OS
            </Link>

            <button
              onClick={carregarOS}
              className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
            >
              Recarregar
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-slate-600">Nenhuma OS encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">OS</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Veículo</th>
                  <th className="py-2 pr-4">Motorista</th>
                  <th className="py-2 pr-4">Início</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Pagamento</th>
                  <th className="py-2 pr-0">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b last:border-b-0 hover:bg-slate-50 transition"
                  >
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/ordens-servico/${o.id}`}
                        className="hover:underline"
                      >
                        {formatNumeroOS(o.numero, o.created_at)}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {o.tipo === "recorrente" ? "Recorrente" : "Eventual"}
                      </div>
                    </td>

                    <td className="py-2 pr-4">{o.clientes?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{o.veiculos?.placa ?? "—"}</td>
                    <td className="py-2 pr-4">{o.motoristas?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{formatDt(o.inicio_em)}</td>

                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${badgeStatus(
                          o.status
                        )}`}
                      >
                        {labelStatus(o.status)}
                      </span>
                    </td>

                    <td className="py-2 pr-4">
                      {labelPagamento(o.status_pagamento)}
                    </td>

                    <td className="py-2 pr-0">
                      {formatMoney(o.valor_total)}
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
