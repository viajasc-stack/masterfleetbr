"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchKPIs, fetchSolicitacoes, fetchAlertasNaoLidos, marcarTodosAlertasLidos } from "@/lib/manutencao";
import type { ManutencaoKPIs, ManutencaoSolicitacao, ManutencaoAlerta } from "@/types/manutencao.types";
import { SOLICITACAO_STATUS_COLORS, SOLICITACAO_STATUS_LABELS } from "@/types/manutencao.types";

export default function ManutencaoDashboardPage() {
  const [kpis, setKpis] = useState<ManutencaoKPIs | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<ManutencaoSolicitacao[]>([]);
  const [alertas, setAlertas] = useState<ManutencaoAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisData, solicitacoesData, alertasData] = await Promise.all([
        fetchKPIs(),
        fetchSolicitacoes(),
        fetchAlertasNaoLidos(),
      ]);
      setKpis(kpisData);
      setSolicitacoes(solicitacoesData.slice(0, 10));
      setAlertas(alertasData.slice(0, 10));
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const emDiagnostico = solicitacoes.filter((s) => s.status === "em_analise").length;
  const aprovadasParaEncaminhar = solicitacoes.filter((s) => s.status === "aprovada").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Dashboard"
        description="Triagem, diagnóstico e gestão de preventivas"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/manutencao/solicitacoes" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm font-medium">
              Inbox de Triagem
            </Link>
            <Link href="/oficina/ordens" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm font-medium shadow-sm">
              Abrir Oficina
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-slate-200 bg-slate-100/70 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <KpiCard label="Solicitações Novas" value={kpis?.solicitacoes_novas ?? 0} color="amber" icon="📥" />
            <KpiCard label="Em Diagnóstico" value={emDiagnostico} color="blue" icon="🩺" />
            <KpiCard label="Aprovadas p/ Encaminhar" value={aprovadasParaEncaminhar} color="indigo" icon="✅" />
            <KpiCard label="Preventivas Vencidas" value={kpis?.preventivas_vencidas ?? 0} color="red" icon="⏰" />
            <KpiCard label="Alertas Pendentes" value={kpis?.alertas_nao_lidos ?? 0} color="orange" icon="🔔" />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Alertas */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">🔔 Alertas de manutenção</h2>
                {alertas.length > 0 && (
                  <button onClick={() => { marcarTodosAlertasLidos(); setAlertas([]); }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    Marcar todos como lidos
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {alertas.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">Nenhum alerta pendente.</p>
                ) : (
                  alertas.map((a) => (
                    <div key={a.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${a.severidade === 'critica' ? 'bg-red-500' : a.severidade === 'alta' ? 'bg-orange-500' : a.severidade === 'media' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                        <span className="text-sm font-medium text-slate-900">{a.titulo}</span>
                      </div>
                      {a.mensagem && <p className="text-xs text-slate-500 mt-1">{a.mensagem}</p>}
                      {a.veiculos && <p className="text-xs text-slate-400 mt-1">{a.veiculos.placa}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Fila de triagem */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">🧭 Fila de Triagem</h2>
                <Link href="/manutencao/solicitacoes" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Abrir inbox →</Link>
              </div>
              <div className="space-y-2">
                {solicitacoes.length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">Nenhuma solicitação recente.</p>
                ) : (
                  solicitacoes.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-900">{s.veiculos?.placa ?? "—"}</span>
                        <span className="text-xs text-slate-500">{s.titulo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${SOLICITACAO_STATUS_COLORS[s.status]}`}>{SOLICITACAO_STATUS_LABELS[s.status]}</span>
                        {s.status === "aprovada" ? (
                          <Link href={`/oficina/nova-ot?origem=manutencao&sol=${s.id}`} className="px-2 py-0.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-500">
                            Encaminhar Oficina
                          </Link>
                        ) : (
                          <Link href="/manutencao/solicitacoes" className="px-2 py-0.5 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">
                            Tratar
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          {/* Links Rápidos */}
          <div className="grid md:grid-cols-5 gap-4">
            <Link href="/manutencao/solicitacoes" className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm">
              <span className="text-2xl">🧭</span>
              <p className="font-medium text-slate-900 mt-2">Inbox de Triagem</p>
              <p className="text-xs text-slate-500">Diagnosticar e decidir encaminhamento</p>
            </Link>
            <Link href="/oficina/ordens" className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm">
              <span className="text-2xl">🏭</span>
              <p className="font-medium text-slate-900 mt-2">Oficina Interna</p>
              <p className="text-xs text-slate-500">Executar serviços encaminhados</p>
            </Link>
            <Link href="/manutencao/preventivas" className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm">
              <span className="text-2xl">📅</span>
              <p className="font-medium text-slate-900 mt-2">Preventivas</p>
              <p className="text-xs text-slate-500">Planos e calendário</p>
            </Link>
            <Link href="/manutencao/planos" className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm">
              <span className="text-2xl">🔧</span>
              <p className="font-medium text-slate-900 mt-2">Planos</p>
              <p className="text-xs text-slate-500">Configurar estratégias preventivas</p>
            </Link>
            <Link href="/ordens-servico" className="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm">
              <span className="text-2xl">🧾</span>
              <p className="font-medium text-slate-900 mt-2">Ordens de Serviço</p>
              <p className="text-xs text-slate-500">Acompanhar execução e status</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon?: string }) {
  const colorClasses: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    indigo: "border-indigo-200 bg-indigo-50",
    orange: "border-orange-200 bg-orange-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };
  const textClasses: Record<string, string> = {
    blue: "text-blue-700",
    indigo: "text-indigo-700",
    orange: "text-orange-700",
    amber: "text-amber-700",
    red: "text-red-700",
    emerald: "text-emerald-700",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[11px] uppercase tracking-wide ${textClasses[color] || textClasses.blue}`}>{label}</p>
        {icon ? <span className="text-base">{icon}</span> : null}
      </div>
      <p className={`text-2xl font-bold mt-2 ${textClasses[color] || textClasses.blue}`}>{value}</p>
    </div>
  );
}