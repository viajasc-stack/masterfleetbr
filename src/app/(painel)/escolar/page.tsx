"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchEscolarKPIs } from "@/lib/escolar";
import type { EscolarKPIs } from "@/types/escolar.types";

export default function EscolarDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<EscolarKPIs | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchEscolarKPIs();
        setKpis(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escolar · Dashboard"
        description="Visão geral da operação escolar"
        actions={<Link href="/escolar/alunos" className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm">Abrir alunos</Link>}
      />

      {loading ? <div className="text-slate-500">Carregando...</div> : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card label="Linhas ativas" value={kpis?.linhas_ativas ?? 0} />
        <Card label="Alunos ativos" value={kpis?.alunos_ativos ?? 0} />
        <Card label="Presenças hoje" value={kpis?.presencas_hoje ?? 0} />
        <Card label="Mens. abertas" value={kpis?.mensalidades_abertas ?? 0} />
        <Card label="Mens. atrasadas" value={kpis?.mensalidades_atrasadas ?? 0} />
        <Card label="Ocorrências" value={kpis?.ocorrencias_abertas ?? 0} />
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Link href="/escolar/linhas" className="rounded-xl border bg-white p-4">🛣️ Linhas</Link>
        <Link href="/escolar/alunos" className="rounded-xl border bg-white p-4">🎒 Alunos</Link>
        <Link href="/escolar/presenca" className="rounded-xl border bg-white p-4">✅ Presença</Link>
        <Link href="/escolar/mensalidades" className="rounded-xl border bg-white p-4">💳 Mensalidades</Link>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
