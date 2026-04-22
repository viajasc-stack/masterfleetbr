"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Stats = {
  total_empresas: number;
  ativas: number;
  trial: number;
  bloqueadas: number;
  past_due: number;
  mrr_centavos: number;
  inadimplencia_pct: number;
  conversao_pct: number;
};

export default function MasterPage() {
  const [stats, setStats] = useState<Stats>({
    total_empresas: 0,
    ativas: 0,
    trial: 0,
    bloqueadas: 0,
    past_due: 0,
    mrr_centavos: 0,
    inadimplencia_pct: 0,
    conversao_pct: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc("master_billing_overview");
      if (!error && data) {
        setStats({
          total_empresas: Number(data.total_empresas ?? 0),
          ativas: Number(data.ativas ?? 0),
          trial: Number(data.trial ?? 0),
          bloqueadas: Number(data.bloqueadas ?? 0),
          past_due: Number(data.past_due ?? 0),
          mrr_centavos: Number(data.mrr_centavos ?? 0),
          inadimplencia_pct: Number(data.inadimplencia_pct ?? 0),
          conversao_pct: Number(data.conversao_pct ?? 0),
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visão Geral</h1>
        <p className="text-slate-600 mt-0.5 text-sm">Métricas do SaaS MasterFleetBR</p>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Total Empresas", value: stats.total_empresas, cor: "border-slate-700 bg-slate-800/50" },
              { label: "Ativas", value: stats.ativas, cor: "border-green-500/30 bg-green-500/10" },
              { label: "Trial", value: stats.trial, cor: "border-blue-500/30 bg-blue-500/10" },
              { label: "Past Due", value: stats.past_due, cor: "border-amber-500/30 bg-amber-500/10" },
              { label: "Bloqueadas", value: stats.bloqueadas, cor: "border-red-500/30 bg-red-500/10" },
            ].map((c) => (
              <div key={c.label} className={`rounded-xl border ${c.cor.replace("border-slate-700 bg-slate-800/50", "border-slate-200 bg-white")} p-5`}>
                <div className="text-3xl font-bold text-slate-900">{c.value}</div>
                <div className="text-sm text-slate-600 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="text-sm text-emerald-700">MRR</div>
              <div className="text-3xl font-bold text-emerald-900">{(stats.mrr_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm text-amber-700">Inadimplência</div>
              <div className="text-3xl font-bold text-amber-900">{stats.inadimplencia_pct}%</div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-5">
              <div className="text-sm text-sky-700">Conversão</div>
              <div className="text-3xl font-bold text-sky-900">{stats.conversao_pct}%</div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href="/master/empresas"
              className="rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50 transition">
              <div className="text-sm font-semibold text-slate-900">Gerenciar Empresas</div>
              <div className="text-xs text-slate-500 mt-0.5">Ações, status e módulos</div>
            </Link>
            <Link href="/master/modulos"
              className="rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50 transition">
              <div className="text-sm font-semibold text-slate-900">Módulos</div>
              <div className="text-xs text-slate-500 mt-0.5">Listagem, preços e disponibilidade dos módulos</div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
