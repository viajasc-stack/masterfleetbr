"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { moeda } from "@/lib/manutencao";

type Ordem = {
  id: string;
  status: "aberta" | "analise" | "aguardando_pecas" | "andamento" | "finalizada";
  prioridade: "baixa" | "media" | "alta";
  custo_total: number;
  created_at: string;
  veiculos: { placa: string | null; modelo: string | null } | null;
};

type Preventiva = {
  id: string;
  status: "em_dia" | "vencendo" | "vencida" | "concluida";
};

function statusBadge(status: string) {
  if (status === "finalizada" || status === "concluida") return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (status === "andamento") return "bg-blue-50 border-blue-200 text-blue-700";
  if (status === "aguardando_pecas") return "bg-amber-50 border-amber-200 text-amber-700";
  if (status === "vencida") return "bg-rose-50 border-rose-200 text-rose-700";
  return "bg-slate-50 border-slate-200 text-slate-700";
}

export default function ManutencaoDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [ordens, setOrdens] = useState<Ordem[]>([]);
  const [preventivas, setPreventivas] = useState<Preventiva[]>([]);

  async function carregar() {
    setLoading(true);

    const [ordensRes, prevRes] = await Promise.all([
      supabase
        .from("ordens_manutencao")
        .select("id,status,prioridade,custo_total,created_at,veiculos(placa,modelo)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.from("preventiva_execucoes").select("id,status"),
    ]);

    setOrdens((ordensRes.data as Ordem[] | null) ?? []);
    setPreventivas((prevRes.data as Preventiva[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const cards = useMemo(() => {
    const abertas = ordens.filter((o) => o.status === "aberta").length;
    const andamento = ordens.filter((o) => o.status === "andamento").length;
    const aguardando = ordens.filter((o) => o.status === "aguardando_pecas").length;
    const vencidas = preventivas.filter((p) => p.status === "vencida").length;

    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    const custoMes = ordens
      .filter((o) => {
        const d = new Date(o.created_at);
        return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
      })
      .reduce((acc, o) => acc + Number(o.custo_total ?? 0), 0);

    return { abertas, andamento, aguardando, vencidas, custoMes };
  }, [ordens, preventivas]);

  const custoPorMes = useMemo(() => {
    const map = new Map<string, number>();
    ordens.forEach((o) => {
      const d = new Date(o.created_at);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      map.set(key, (map.get(key) ?? 0) + Number(o.custo_total ?? 0));
    });
    return [...map.entries()].map(([mes, total]) => ({ mes, total })).slice(-6);
  }, [ordens]);

  const custoPorVeiculo = useMemo(() => {
    const map = new Map<string, number>();
    ordens.forEach((o) => {
      const nome = o.veiculos?.placa ?? "Sem placa";
      map.set(nome, (map.get(nome) ?? 0) + Number(o.custo_total ?? 0));
    });

    return [...map.entries()]
      .map(([veiculo, total]) => ({ veiculo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [ordens]);

  const urgentes = useMemo(
    () => ordens.filter((o) => o.prioridade === "alta" && o.status !== "finalizada").slice(0, 8),
    [ordens],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Dashboard"
        description="Visão geral de ordens, preventiva e custos do módulo de manutenção."
        actions={
          <>
            <Link href="/manutencao/solicitacoes" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">
              Solicitações
            </Link>
            <Link href="/manutencao/ordens" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">
              Ordens
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card titulo="OS abertas" valor={String(cards.abertas)} />
        <Card titulo="OS em andamento" valor={String(cards.andamento)} />
        <Card titulo="Aguardando peças" valor={String(cards.aguardando)} />
        <Card titulo="Preventivas vencidas" valor={String(cards.vencidas)} />
        <Card titulo="Custo do mês" valor={moeda(cards.custoMes)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GraficoBarras
          titulo="Custo por mês"
          itens={custoPorMes.map((m) => ({ label: m.mes, valor: m.total }))}
        />
        <GraficoBarras
          titulo="Custo por veículo"
          itens={custoPorVeiculo.map((m) => ({ label: m.veiculo, valor: m.total }))}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Veículos com maior custo</h2>
          <div className="space-y-2 text-sm">
            {custoPorVeiculo.length === 0 ? (
              <div className="text-slate-500">Sem dados.</div>
            ) : (
              custoPorVeiculo.map((item) => (
                <div key={item.veiculo} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
                  <span>{item.veiculo}</span>
                  <span className="font-medium">{moeda(item.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">OS urgentes</h2>
          <div className="space-y-2 text-sm">
            {urgentes.length === 0 ? (
              <div className="text-slate-500">Sem urgências no momento.</div>
            ) : (
              urgentes.map((o) => (
                <Link
                  key={o.id}
                  href={`/manutencao/ordens/${o.id}`}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 hover:text-indigo-700"
                >
                  <span>{o.veiculos?.placa ?? "Sem veículo"}</span>
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs border ${statusBadge(o.status)}`}>{o.status.replaceAll("_", " ")}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-slate-500">Carregando dashboard...</div> : null}
    </div>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{valor}</p>
    </div>
  );
}

function GraficoBarras({ titulo, itens }: { titulo: string; itens: Array<{ label: string; valor: number }> }) {
  const max = Math.max(...itens.map((i) => i.valor), 1);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">{titulo}</h2>
      <div className="space-y-3">
        {itens.length === 0 ? (
          <div className="text-sm text-slate-500">Sem dados.</div>
        ) : (
          itens.map((i) => (
            <div key={i.label}>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>{i.label}</span>
                <span>{moeda(i.valor)}</span>
              </div>
              <div className="h-2 rounded bg-slate-100 overflow-hidden">
                <div className="h-2 bg-indigo-500" style={{ width: `${(i.valor / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
