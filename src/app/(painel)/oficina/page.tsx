"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchKPIs, fetchOTs, moeda, formatarTempo } from "@/lib/oficina";
import type { OficinaKPIs, OficinaOT } from "@/types/oficina.types";
import { STATUS_OT_COLORS, STATUS_OT_LABELS, PRIORIDADE_COLORS, PRIORIDADE_LABELS } from "@/types/oficina.types";

export default function OficinaDashboardPage() {
  const [kpis, setKpis] = useState<OficinaKPIs | null>(null);
  const [ots, setOts] = useState<OficinaOT[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisData, otsData] = await Promise.all([
        fetchKPIs(),
        fetchOTs(),
      ]);
      setKpis(kpisData);
      setOts(otsData.slice(0, 10));
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficina · Dashboard"
        description="Visão geral da oficina interna"
        actions={
          <div className="flex gap-2">
            <Link href="/oficina/mecanicos" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
              Mecânicos
            </Link>
            <Link href="/oficina/nova-ot" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm">
              + Nova OT
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-slate-500">Carregando...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label="OTs Abertas" value={kpis?.ot_abertas ?? 0} color="blue" />
            <KpiCard label="OTs Finalizadas" value={kpis?.ot_finalizadas ?? 0} color="emerald" />
            <KpiCard label="Total OTs" value={kpis?.total_ot ?? 0} color="slate" />
            <KpiCard label="Faturamento" value={moeda(kpis?.faturamento_total ?? 0)} color="green" />
            <KpiCard label="Ticket Médio" value={moeda(kpis?.ticket_medio ?? 0)} color="indigo" />
            <KpiCard label="Tempo Médio" value={formatarTempo(kpis?.tempo_medio_horas ?? 0)} color="amber" />
          </div>

          {/* OTs Recentes */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">📋 Ordens de Trabalho Recentes</h2>
              <Link href="/oficina/ordens" className="text-xs text-indigo-600 hover:text-indigo-800">Ver todas →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 bg-slate-50">
                    <th className="py-3 px-4">OT #</th>
                    <th className="py-3 px-4">Veículo</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Prioridade</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Entrada</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ots.length === 0 ? (
                    <tr><td colSpan={7} className="py-6 text-center text-slate-500">Nenhuma OT registrada.</td></tr>
                  ) : (
                    ots.map(ot => (
                      <tr key={ot.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-medium">{ot.numero}</td>
                        <td className="py-3 px-4">{ot.veiculos?.placa ?? "—"}</td>
                        <td className="py-3 px-4 capitalize">{ot.tipo_servico}</td>
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
                        <td className="py-3 px-4 text-right">
                          <Link href={`/oficina/ordens/${ot.id}`} className="px-3 py-1.5 text-xs border border-slate-300 rounded-md hover:bg-slate-50">
                            Detalhar
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Links Rápidos */}
          <div className="grid md:grid-cols-4 gap-4">
            <Link href="/oficina/nova-ot" className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <span className="text-2xl">🔧</span>
              <p className="font-medium text-slate-900 mt-2">Nova OT</p>
              <p className="text-xs text-slate-500">Criar ordem de trabalho</p>
            </Link>
            <Link href="/oficina/mecanicos" className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <span className="text-2xl">👷</span>
              <p className="font-medium text-slate-900 mt-2">Mecânicos</p>
              <p className="text-xs text-slate-500">Gerenciar equipe</p>
            </Link>
            <Link href="/oficina/orcamentos" className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <span className="text-2xl">📄</span>
              <p className="font-medium text-slate-900 mt-2">Orçamentos</p>
              <p className="text-xs text-slate-500">Aprovar orçamentos</p>
            </Link>
            <Link href="/oficina/kpis" className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
              <span className="text-2xl">📊</span>
              <p className="font-medium text-slate-900 mt-2">Indicadores</p>
              <p className="text-xs text-slate-500">KPIs e relatórios</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    emerald: "border-emerald-200 bg-emerald-50",
    slate: "border-slate-200 bg-slate-50",
    green: "border-green-200 bg-green-50",
    indigo: "border-indigo-200 bg-indigo-50",
    amber: "border-amber-200 bg-amber-50",
  };
  const textClasses: Record<string, string> = {
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    slate: "text-slate-700",
    green: "text-green-700",
    indigo: "text-indigo-700",
    amber: "text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.slate}`}>
      <p className={`text-xs uppercase tracking-wide ${textClasses[color] || textClasses.slate}`}>{label}</p>
      <p className={`text-2xl font-bold mt-1 ${textClasses[color] || textClasses.slate}`}>{value}</p>
    </div>
  );
}

function dataBR(data: string | null | undefined): string {
  if (!data) return "—";
  return new Date(data).toLocaleDateString("pt-BR");
}