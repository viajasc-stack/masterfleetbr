"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchVeiculoPlanos, processarPreventivas, dataBR, diasAte } from "@/lib/manutencao";
import type { ManutencaoVeiculoPlano } from "@/types/manutencao.types";
import { PREVENTIVA_STATUS_LABELS, PREVENTIVA_STATUS_COLORS } from "@/types/manutencao.types";

export default function PreventivasPage() {
  const [planos, setPlanos] = useState<ManutencaoVeiculoPlano[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVeiculoPlanos();
      setPlanos(data);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleProcessar() {
    setProcessando(true);
    try {
      const count = await processarPreventivas();
      alert(`${count} preventiva(s) processada(s) com sucesso!`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao processar preventivas.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Preventivas"
        description="Acompanhamento de vencimentos e encaminhamento para triagem"
        actions={
          <div className="flex gap-2">
            <Link href="/manutencao/solicitacoes" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
              Inbox de Triagem
            </Link>
            <Link href="/manutencao/planos" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
              Configurar Planos
            </Link>
            <button onClick={handleProcessar} disabled={processando} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm disabled:opacity-60">
              {processando ? "Processando..." : "Atualizar Preventivas"}
            </button>
          </div>
        }
      />

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
        A manutenção preventiva aqui funciona como <strong>gestão e gatilho de triagem</strong>. A execução do serviço deve ser encaminhada pela inbox para a Oficina interna ou externa.
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 uppercase">Em dia</p>
          <p className="text-2xl font-bold text-emerald-700">{planos.filter(p => p.status === "em_dia").length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-600 uppercase">Vencendo</p>
          <p className="text-2xl font-bold text-amber-700">{planos.filter(p => p.status === "vencendo_proximo").length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 uppercase">Vencidas</p>
          <p className="text-2xl font-bold text-red-700">{planos.filter(p => p.status === "vencida").length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 uppercase">Total</p>
          <p className="text-2xl font-bold text-blue-700">{planos.length}</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : planos.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhum plano preventivo configurado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4">Veículo</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4">Última Execução</th>
                <th className="py-3 px-4">Próxima Data</th>
                <th className="py-3 px-4">Próximo KM</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {planos.map(p => {
                const dias = diasAte(p.proxima_execucao_data);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-medium">{p.veiculos?.placa ?? "—"}</td>
                    <td className="py-3 px-4">{p.manutencao_planos?.nome ?? "—"}</td>
                    <td className="py-3 px-4 text-slate-500">{dataBR(p.ultima_execucao)}</td>
                    <td className="py-3 px-4">
                      {dataBR(p.proxima_execucao_data)}
                      {dias !== null && dias <= 7 && <span className="ml-2 text-xs text-amber-600">({dias} dias)</span>}
                      {dias !== null && dias < 0 && <span className="ml-2 text-xs text-red-600">({Math.abs(dias)} dias atrasado)</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500">{p.proxima_execucao_km ? `${p.proxima_execucao_km.toLocaleString("pt-BR")} km` : "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${PREVENTIVA_STATUS_COLORS[p.status]}`}>{PREVENTIVA_STATUS_LABELS[p.status]}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/manutencao/solicitacoes?origem=preventiva&plano=${p.id}`} className="px-3 py-1.5 text-xs border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50">
                        Encaminhar p/ Triagem
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}