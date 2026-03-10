"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";

type Indicadores = {
  total: number;
  concluidas: number;
  pendentes: number;
  urgentes: number;
  custo_total: number;
  tempo_parado_horas: number;
};

export default function ManutencaoIndicadoresPage() {
  const [dados, setDados] = useState<Indicadores | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("rpc_manutencao_indicadores", {
      p_data_inicio: null,
      p_data_fim: null,
    });
    if (error) {
      alert(error.message);
      setDados(null);
    } else {
      setDados((data ?? null) as Indicadores | null);
    }
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Indicadores de manutenção" description="Visão gerencial de custo, volume, urgência e disponibilidade." />

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">Carregando...</div>
      ) : !dados ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600">Sem dados no período.</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <Card title="Total" value={String(dados.total ?? 0)} />
          <Card title="Concluídas" value={String(dados.concluidas ?? 0)} />
          <Card title="Pendentes" value={String(dados.pendentes ?? 0)} />
          <Card title="Urgentes" value={String(dados.urgentes ?? 0)} />
          <Card title="Custo total" value={Number(dados.custo_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
          <Card title="Tempo parado (h)" value={Number(dados.tempo_parado_horas ?? 0).toLocaleString("pt-BR")} />
        </div>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
