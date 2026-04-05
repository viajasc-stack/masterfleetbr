"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchOrcamentos, moeda, dataBR } from "@/lib/oficina";
import type { OficinaOrcamento } from "@/types/oficina.types";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  parcial: "Parcial",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-700 border-amber-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejeitado: "bg-red-50 text-red-700 border-red-200",
  parcial: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function OficinaOrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<OficinaOrcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOrcamentos(filtroStatus === "todos" ? undefined : filtroStatus);
      setOrcamentos(data);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oficina · Orçamentos"
        description="Gestão de orçamentos da oficina"
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-3 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2 text-sm" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : orcamentos.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Nenhum orçamento encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 bg-slate-50">
                <th className="py-3 px-4">Orçamento #</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">OT Vinculada</th>
                <th className="py-3 px-4">Validade</th>
                <th className="py-3 px-4">Valor Total</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orcamentos.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-medium">{o.numero}</td>
                  <td className="py-3 px-4">{("clientes" in o ? (o as OficinaOrcamento & { clientes?: { nome: string | null } | null }).clientes?.nome : null) ?? "—"}</td>
                  <td className="py-3 px-4">{("oficina_ordens_trabalho" in o ? (o as OficinaOrcamento & { oficina_ordens_trabalho?: { numero: number | null } | null }).oficina_ordens_trabalho?.numero : null) ? `OT #${(o as OficinaOrcamento & { oficina_ordens_trabalho?: { numero: number | null } | null }).oficina_ordens_trabalho?.numero}` : "—"}</td>
                  <td className="py-3 px-4 text-slate-500">{dataBR(o.validade)}</td>
                  <td className="py-3 px-4 font-medium">{moeda(o.valor_total)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
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