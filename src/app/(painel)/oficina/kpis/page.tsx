"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchKPIs, moeda, formatarTempo } from "@/lib/oficina";
import type { OficinaKPIs } from "@/types/oficina.types";

export default function OficinaKPIsPage() {
  const [kpis, setKpis] = useState<OficinaKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dias = parseInt(periodo);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);
      const data = await fetchKPIs(dataInicio.toISOString().split("T")[0], undefined);
      setKpis(data);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficina · Indicadores"
        description="KPIs e métricas de desempenho da oficina"
        actions={
          <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="180">Últimos 6 meses</option>
          </select>
        }
      />

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total OTs" value={kpis?.total_ot ?? 0} />
        <KpiCard label="OTs Abertas" value={kpis?.ot_abertas ?? 0} color="blue" />
        <KpiCard label="OTs Finalizadas" value={kpis?.ot_finalizadas ?? 0} color="emerald" />
        <KpiCard label="Faturamento" value={moeda(kpis?.faturamento_total ?? 0)} color="green" />
        <KpiCard label="Ticket Médio" value={moeda(kpis?.ticket_medio ?? 0)} color="indigo" />
        <KpiCard label="Tempo Médio" value={formatarTempo(kpis?.tempo_medio_horas ?? 0)} color="amber" />
      </div>

      {/* Por Tipo de Serviço */}
      {kpis?.por_tipo_servico && kpis.por_tipo_servico.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4">📊 OTs por Tipo de Serviço</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {kpis.por_tipo_servico.map(t => (
              <div key={t.tipo} className="p-4 rounded-lg border border-slate-100 bg-slate-50">
                <p className="text-sm text-slate-500 capitalize">{t.tipo}</p>
                <p className="text-2xl font-bold text-slate-900">{t.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Mecânicos */}
      {kpis?.top_mecanicos && kpis.top_mecanicos.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-900 mb-4">👷 Top Mecânicos</h2>
          <div className="grid md:grid-cols-5 gap-4">
            {kpis.top_mecanicos.map((m, i) => (
              <div key={m.mecanico} className="p-4 rounded-lg border border-slate-100 bg-slate-50">
                <span className="text-xs text-slate-500">#{i + 1}</span>
                <p className="text-sm font-medium text-slate-900">{m.mecanico}</p>
                <p className="text-lg font-bold text-slate-900">{m.ots} OTs</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, color = "slate" }: { label: string; value: string | number; color?: string }) {
  const colorClasses: Record<string, string> = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    green: "bg-green-50 border-green-200 text-green-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.slate}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}