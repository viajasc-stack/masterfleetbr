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

type AssinaturaRaw = {
  status: string;
  planos: { valor_centavos: number }[] | { valor_centavos: number } | null;
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
      const { data } = await supabase.from("assinaturas").select("status, plano_id, planos(valor_centavos)");
      const raw = (data ?? []) as AssinaturaRaw[];
      const list = raw.map((a: AssinaturaRaw) => {
        const p = a.planos;
        const v = Array.isArray(p) ? (p[0]?.valor_centavos ?? 0) : (p?.valor_centavos ?? 0);
        return { status: String(a.status), valor_centavos: Number(v) };
      });
      const ativas = list.filter((a) => a.status === "ativa");
      const trial = list.filter((a) => a.status === "trial");
      const bloqueadas = list.filter((a) => a.status === "bloqueada");
      const past_due = list.filter((a) => a.status === "past_due");
      const mrr_centavos = ativas.reduce((sum, a) => sum + a.valor_centavos, 0);
      const total = list.length;
      const inadimplencia_pct = total > 0 ? Math.round(((past_due.length + bloqueadas.length) / total) * 100) : 0;
      const baseConv = ativas.length + trial.length;
      const conversao_pct = baseConv > 0 ? Math.round((ativas.length / baseConv) * 100) : 0;
      setStats({
        total_empresas: total,
        ativas: ativas.length,
        trial: trial.length,
        bloqueadas: bloqueadas.length,
        past_due: past_due.length,
        mrr_centavos,
        inadimplencia_pct,
        conversao_pct,
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Visão Geral</h1>
        <p className="text-slate-400 mt-0.5 text-sm">Métricas do SaaS MasterFleetBR</p>
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
              <div key={c.label} className={`rounded-xl border ${c.cor} p-5`}>
                <div className="text-3xl font-bold text-white">{c.value}</div>
                <div className="text-sm text-slate-400 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="text-sm text-slate-400">MRR</div>
              <div className="text-3xl font-bold text-white">{(stats.mrr_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
              <div className="text-sm text-slate-400">Inadimplência</div>
              <div className="text-3xl font-bold text-white">{stats.inadimplencia_pct}%</div>
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-5">
              <div className="text-sm text-slate-400">Conversão</div>
              <div className="text-3xl font-bold text-white">{stats.conversao_pct}%</div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href="/master/empresas"
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:bg-slate-800/60 transition">
              <div className="text-sm font-semibold text-white">Gerenciar Empresas</div>
              <div className="text-xs text-slate-500 mt-0.5">Ações, status, planos</div>
            </Link>
            <Link href="/master/planos"
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:bg-slate-800/60 transition">
              <div className="text-sm font-semibold text-white">Planos</div>
              <div className="text-xs text-slate-500 mt-0.5">CRUD de planos</div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
