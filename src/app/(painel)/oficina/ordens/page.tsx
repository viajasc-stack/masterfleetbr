"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchOTs, dataBR } from "@/lib/oficina";
import type { OficinaOT } from "@/types/oficina.types";
import { STATUS_OT_COLORS, STATUS_OT_LABELS, PRIORIDADE_COLORS, PRIORIDADE_LABELS, TIPO_SERVICO_LABELS } from "@/types/oficina.types";

export default function OficinaOrdensPage() {
  const [ots, setOts] = useState<OficinaOT[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOTs(
        filtroStatus === "todos" ? undefined : filtroStatus,
        filtroTipo === "todos" ? undefined : filtroTipo
      );
      setOts(data);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, filtroTipo]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtradas = busca
    ? ots.filter(o => o.veiculos?.placa?.toLowerCase().includes(busca.toLowerCase()) || o.reclamacao_cliente?.toLowerCase().includes(busca.toLowerCase()))
    : ots;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficina · Ordens de Trabalho"
        description="Gestão de ordens de trabalho"
        actions={
          <Link href="/oficina/nova-ot" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">
            + Nova OT
          </Link>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-4 gap-3">
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Buscar por placa ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_OT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_SERVICO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhuma OT encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4">OT #</th>
                <th className="py-3 px-4">Veículo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Prioridade</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Entrada</th>
                <th className="py-3 px-4">Valor Total</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map(ot => (
                <tr key={ot.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-medium">{ot.numero}</td>
                  <td className="py-3 px-4">{ot.veiculos?.placa ?? "—"}</td>
                  <td className="py-3 px-4">{TIPO_SERVICO_LABELS[ot.tipo_servico]}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORIDADE_COLORS[ot.prioridade]}`}>
                      {PRIORIDADE_LABELS[ot.prioridade]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_OT_COLORS[ot.status]}`}>
                      {STATUS_OT_LABELS[ot.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{dataBR(ot.data_entrada)}</td>
                  <td className="py-3 px-4 font-medium">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ot.valor_total)}</td>
                  <td className="py-3 px-4 text-right">
                    <Link href={`/oficina/ordens/${ot.id}`} className="px-3 py-1.5 text-xs border border-slate-300 rounded-md hover:bg-slate-50">
                      Detalhar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}