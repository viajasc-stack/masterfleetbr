"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchOrdens, dataBR } from "@/lib/manutencao";
import type { ManutencaoOrdem } from "@/types/manutencao.types";
import { STATUS_COLORS, STATUS_LABELS, PRIORIDADE_COLORS, PRIORIDADE_LABELS } from "@/types/manutencao.types";

export default function OrdensManutencaoPage() {
  const [ordens, setOrdens] = useState<ManutencaoOrdem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [busca, setBusca] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOrdens(
        filtroStatus === "todos" ? undefined : filtroStatus,
        filtroTipo === "todos" ? undefined : filtroTipo
      );
      setOrdens(data);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, filtroTipo]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase();
    if (!q) return ordens;
    return ordens.filter(o =>
      o.veiculos?.placa?.toLowerCase().includes(q) ||
      o.veiculos?.modelo?.toLowerCase().includes(q) ||
      o.diagnostico?.toLowerCase().includes(q) ||
      o.tipo.toLowerCase().includes(q)
    );
  }, [ordens, busca]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Ordens de Serviço"
        description="Gestão completa de ordens de manutenção"
        actions={
          <Link href="/manutencao/ordens/nova" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">
            + Nova OS
          </Link>
        }
      />

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-4 gap-3">
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Buscar por placa, modelo, diagnóstico..." value={busca} onChange={e => setBusca(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="corretiva">Corretiva</option>
          <option value="preventiva">Preventiva</option>
          <option value="emergencial">Emergencial</option>
          <option value="preditiva">Preditiva</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhuma ordem encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4">Veículo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Prioridade</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Abertura</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4">
                    <span className="font-medium">{o.veiculos?.placa ?? "—"}</span>
                    {o.veiculos?.modelo && <span className="text-slate-500 text-xs ml-2">{o.veiculos.modelo}</span>}
                  </td>
                  <td className="py-3 px-4 capitalize">{o.tipo}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORIDADE_COLORS[o.prioridade]}`}>{PRIORIDADE_LABELS[o.prioridade]}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[o.status]}`}>{STATUS_LABELS[o.status]}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{dataBR(o.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <Link href={`/manutencao/ordens/${o.id}`} className="px-3 py-1.5 text-xs border border-slate-300 rounded-md hover:bg-slate-50">
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