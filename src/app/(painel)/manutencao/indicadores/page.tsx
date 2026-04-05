"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchKPIs, fetchSolicitacoes, fetchVeiculoPlanos, fetchAlertasNaoLidos } from "@/lib/manutencao";
import type { ManutencaoKPIs } from "@/types/manutencao.types";
import { PREVENTIVA_STATUS_LABELS, SOLICITACAO_STATUS_LABELS } from "@/types/manutencao.types";

export default function IndicadoresManutencaoPage() {
  const [kpis, setKpis] = useState<ManutencaoKPIs | null>(null);
  const [solicitacoesResumo, setSolicitacoesResumo] = useState<Record<string, number>>({});
  const [preventivasResumo, setPreventivasResumo] = useState<Record<string, number>>({});
  const [alertasPendentes, setAlertasPendentes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dias = parseInt(periodo);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const [kpisData, solicitacoesData, preventivasData, alertasData] = await Promise.all([
        fetchKPIs(dataInicio.toISOString().split("T")[0], undefined),
        fetchSolicitacoes(),
        fetchVeiculoPlanos(),
        fetchAlertasNaoLidos(),
      ]);

      setKpis(kpisData);
      setAlertasPendentes(alertasData.length);

      const solicitacoesContagem = solicitacoesData.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {});
      setSolicitacoesResumo(solicitacoesContagem);

      const preventivasContagem = preventivasData.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
      }, {});
      setPreventivasResumo(preventivasContagem);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando indicadores...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Indicadores"
        description="KPIs e listagem geral de tudo que envolve manutenção"
        actions={
          <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="180">Últimos 6 meses</option>
          </select>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 mb-4">📚 Listagem Geral da Manutenção</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link href="/manutencao" className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <p className="text-sm font-medium text-slate-900">Dashboard de Manutenção</p>
            <p className="text-xs text-slate-500 mt-1">Visão consolidada do módulo.</p>
          </Link>

          <Link href="/manutencao/solicitacoes" className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <p className="text-sm font-medium text-slate-900">Solicitações (Triagem)</p>
            <p className="text-xs text-slate-500 mt-1">
              Novas: {solicitacoesResumo.nova ?? 0} · Em análise: {solicitacoesResumo.em_analise ?? 0} · Aprovadas: {solicitacoesResumo.aprovada ?? 0}
            </p>
          </Link>

          <Link href="/manutencao/preventivas" className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <p className="text-sm font-medium text-slate-900">Preventivas</p>
            <p className="text-xs text-slate-500 mt-1">
              Em dia: {preventivasResumo.em_dia ?? 0} · Vencendo: {preventivasResumo.vencendo_proximo ?? 0} · Vencidas: {preventivasResumo.vencida ?? 0}
            </p>
          </Link>

          <Link href="/manutencao/planos" className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <p className="text-sm font-medium text-slate-900">Planos de Manutenção</p>
            <p className="text-xs text-slate-500 mt-1">Estratégias e parametrizações preventivas.</p>
          </Link>

          <Link href="/oficina/ordens" className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
            <p className="text-sm font-medium text-slate-900">Execução na Oficina</p>
            <p className="text-xs text-slate-500 mt-1">Ordens de trabalho encaminhadas após diagnóstico.</p>
          </Link>

          <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
            <p className="text-sm font-medium text-slate-900">Alertas Pendentes</p>
            <p className="text-xs text-slate-500 mt-1">{alertasPendentes} alerta(s) aguardando ação.</p>
          </div>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="Total de OS" value={kpis?.total_os ?? 0} />
        <KpiCard label="OS Abertas" value={kpis?.os_abertas ?? 0} />
        <KpiCard label="Em Andamento" value={kpis?.os_em_andamento ?? 0} />
        <KpiCard label="Finalizadas" value={kpis?.os_finalizadas ?? 0} />
      </div>

      {/* KPIs Secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Solicitações Novas" value={kpis?.solicitacoes_novas ?? 0} color="amber" />
        <KpiCard label="Preventivas Vencidas" value={kpis?.preventivas_vencidas ?? 0} color="red" />
        <KpiCard label="Alertas Pendentes" value={kpis?.alertas_nao_lidos ?? 0} color="orange" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-900 mb-3">📌 Resumo por Status</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-800 mb-2">Solicitações</p>
            <ul className="space-y-1 text-slate-600">
              {Object.entries(SOLICITACAO_STATUS_LABELS).map(([status, label]) => (
                <li key={status} className="flex items-center justify-between">
                  <span>{label}</span>
                  <strong>{solicitacoesResumo[status] ?? 0}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-slate-800 mb-2">Preventivas</p>
            <ul className="space-y-1 text-slate-600">
              {Object.entries(PREVENTIVA_STATUS_LABELS).map(([status, label]) => (
                <li key={status} className="flex items-center justify-between">
                  <span>{label}</span>
                  <strong>{preventivasResumo[status] ?? 0}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
}

function KpiCard({ label, value, color = "slate" }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.slate}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}