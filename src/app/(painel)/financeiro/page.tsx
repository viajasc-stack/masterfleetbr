"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Resumo = {
  a_pagar: number;
  a_receber: number;
  vencidas_pagar: number;
  vencidas_receber: number;
  total_pagar: number;
  total_receber: number;
};

type Conta = {
  id: string;
  descricao: string;
  tipo: "pagar" | "receber";
  valor: number;
  data_vencimento: string;
  status: string;
  categoria: string | null;
};

type SerieMensal = {
  mes: string;
  pagar: number;
  receber: number;
};

type Billing = {
  status: string;
  plano_nome?: string | null;
  trial_ate?: string | null;
  proxima_cobranca?: string | null;
};

export default function FinanceiroPage() {
  const [resumo, setResumo] = useState<Resumo>({ a_pagar: 0, a_receber: 0, vencidas_pagar: 0, vencidas_receber: 0, total_pagar: 0, total_receber: 0 });
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const hoje = new Date().toISOString().slice(0, 10);

      const { data } = await supabase.from("contas_financeiras")
        .select("id, descricao, tipo, valor, data_vencimento, status, categoria")
        .in("status", ["pendente", "pago", "recebido"])
        .order("data_vencimento", { ascending: true })
        .limit(500);

      const lista = (data as Conta[]) ?? [];
      setContas(lista);

      const pendPagar = lista.filter((c) => c.tipo === "pagar" && c.status === "pendente");
      const pendReceber = lista.filter((c) => c.tipo === "receber" && c.status === "pendente");

      setResumo({
        a_pagar: pendPagar.length,
        a_receber: pendReceber.length,
        vencidas_pagar: pendPagar.filter((c) => c.data_vencimento < hoje).length,
        vencidas_receber: pendReceber.filter((c) => c.data_vencimento < hoje).length,
        total_pagar: pendPagar.reduce((s, c) => s + c.valor, 0),
        total_receber: pendReceber.reduce((s, c) => s + c.valor, 0),
      });

      const { data: bill } = await supabase.rpc("get_billing_current");
      if (bill) {
        setBilling({
          status: bill.status ?? "trial",
          plano_nome: bill.plano_nome ?? null,
          trial_ate: bill.trial_ate ?? null,
          proxima_cobranca: bill.proxima_cobranca ?? null,
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hoje = new Date().toISOString().slice(0, 10);

  const proximas = contas.filter((c) => c.status === "pendente").slice(0, 10);

  const analytics = (() => {
    const pendentes = contas.filter((c) => c.status === "pendente");
    const pagasOuRecebidas = contas.filter((c) => c.status === "pago" || c.status === "recebido");
    const recebimentosRealizados = pagasOuRecebidas
      .filter((c) => c.tipo === "receber")
      .reduce((s, c) => s + c.valor, 0);
    const pagamentosRealizados = pagasOuRecebidas
      .filter((c) => c.tipo === "pagar")
      .reduce((s, c) => s + c.valor, 0);

    const taxaInadimplencia = resumo.a_receber > 0
      ? (resumo.vencidas_receber / resumo.a_receber) * 100
      : 0;

    const byCategoriaMap = new Map<string, number>();
    for (const c of pendentes) {
      const key = c.categoria?.trim() || "Sem categoria";
      byCategoriaMap.set(key, (byCategoriaMap.get(key) || 0) + c.valor);
    }
    const byCategoria = Array.from(byCategoriaMap.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const seriesMap = new Map<string, SerieMensal>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      seriesMap.set(key, { mes: `${monthLabels[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`, pagar: 0, receber: 0 });
    }

    for (const c of pendentes) {
      const key = c.data_vencimento?.slice(0, 7);
      if (!key || !seriesMap.has(key)) continue;
      const entry = seriesMap.get(key)!;
      if (c.tipo === "pagar") entry.pagar += c.valor;
      else entry.receber += c.valor;
    }

    const series = Array.from(seriesMap.values());
    const maxSerie = Math.max(1, ...series.map((s) => Math.max(s.pagar, s.receber)));

    return {
      recebimentosRealizados,
      pagamentosRealizados,
      fluxoRealizado: recebimentosRealizados - pagamentosRealizados,
      taxaInadimplencia,
      byCategoria,
      series,
      maxSerie,
    };
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Financeiro</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Contas a pagar e a receber</p>
        </div>
        <Link href="/financeiro/contas/nova" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg shadow-sm transition">
          + Nova Conta
        </Link>
      </div>

      {billing && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-600">Assinatura</span>
            <span className={`ml-2 text-xs px-2 py-1 rounded border ${
              billing.status === "ativa" ? "border-emerald-200 text-emerald-700 bg-emerald-50"
              : billing.status === "trial" ? "border-indigo-200 text-indigo-700 bg-indigo-50"
              : billing.status === "past_due" ? "border-amber-200 text-amber-700 bg-amber-50"
              : "border-rose-200 text-rose-700 bg-rose-50"
            }`}>{billing.status}</span>
            {billing.plano_nome && <span className="ml-2 text-slate-600">Plano: <span className="text-slate-900 font-medium">{billing.plano_nome}</span></span>}
            {billing.proxima_cobranca && <span className="ml-2 text-slate-600">Próx.: <span className="text-slate-900">{new Date(billing.proxima_cobranca).toLocaleDateString("pt-BR")}</span></span>}
            {billing.trial_ate && <span className="ml-2 text-slate-600">Trial: <span className="text-slate-900">{new Date(billing.trial_ate).toLocaleDateString("pt-BR")}</span></span>}
          </div>
          {(billing.status === "past_due" || billing.status === "bloqueada") && (
            <Link href="/bloqueado" className="text-xs text-amber-700 font-medium hover:underline">Regularizar</Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
              <div className="text-2xl font-bold text-slate-900">{fmt(resumo.total_pagar)}</div>
              <div className="text-sm text-slate-600 mt-1">A Pagar ({resumo.a_pagar})</div>
              {resumo.vencidas_pagar > 0 && <div className="text-xs text-rose-600 mt-1 font-medium">{resumo.vencidas_pagar} vencida(s)</div>}
            </div>
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
              <div className="text-2xl font-bold text-slate-900">{fmt(resumo.total_receber)}</div>
              <div className="text-sm text-slate-600 mt-1">A Receber ({resumo.a_receber})</div>
              {resumo.vencidas_receber > 0 && <div className="text-xs text-amber-600 mt-1 font-medium">{resumo.vencidas_receber} vencida(s)</div>}
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-sm">
              <div className={`text-2xl font-bold ${resumo.total_receber - resumo.total_pagar >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {fmt(resumo.total_receber - resumo.total_pagar)}
              </div>
              <div className="text-sm text-slate-300 mt-1">Saldo Projetado</div>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
              <div className={`text-2xl font-bold ${analytics.fluxoRealizado >= 0 ? "text-indigo-700" : "text-rose-600"}`}>
                {fmt(analytics.fluxoRealizado)}
              </div>
              <div className="text-sm text-slate-600 mt-1">Valor em Caixa</div>
            </div>
            <Link href="/financeiro/contas/nova" className="rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50 transition shadow-sm flex flex-col justify-center">
              <div className="text-sm font-semibold text-slate-900">Nova Conta</div>
              <div className="text-xs text-slate-500 mt-0.5">Pagar ou receber</div>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Fluxo realizado</div>
              <div className={`text-2xl font-bold mt-1 ${analytics.fluxoRealizado >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {fmt(analytics.fluxoRealizado)}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Recebido: <span className="text-emerald-600 font-medium">{fmt(analytics.recebimentosRealizados)}</span>
                <span className="mx-1">•</span>
                Pago: <span className="text-rose-600 font-medium">{fmt(analytics.pagamentosRealizados)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Inadimplência (a receber)</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{analytics.taxaInadimplencia.toFixed(1)}%</div>
              <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(0, analytics.taxaInadimplencia))}%` }} />
              </div>
              <div className="mt-2 text-xs text-slate-500">{resumo.vencidas_receber} de {resumo.a_receber} contas pendentes vencidas</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Sugestões rápidas</div>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 list-disc pl-4">
                <li>Priorizar recebíveis vencidos acima de 30 dias.</li>
                <li>Negociar maiores categorias de pagamento pendente.</li>
                <li>Revisar contas sem categoria para melhorar análises.</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Projeção 6 meses (pendente)</div>
              <div className="space-y-3">
                {analytics.series.map((s) => (
                  <div key={s.mes}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{s.mes}</span>
                      <span>Pagar {fmt(s.pagar)} • Receber {fmt(s.receber)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-rose-500" style={{ width: `${(s.pagar / analytics.maxSerie) * 100}%` }} />
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div className="h-full bg-emerald-500" style={{ width: `${(s.receber / analytics.maxSerie) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Top categorias pendentes</div>
              {analytics.byCategoria.length === 0 ? (
                <div className="text-sm text-slate-500">Sem dados pendentes por categoria.</div>
              ) : (
                <div className="space-y-3">
                  {analytics.byCategoria.map((item) => {
                    const max = analytics.byCategoria[0]?.total || 1;
                    const pct = (item.total / max) * 100;
                    return (
                      <div key={item.categoria}>
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>{item.categoria}</span>
                          <span>{fmt(item.total)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-sky-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Próximos vencimentos</span>
              <Link href="/financeiro/contas" className="text-xs text-indigo-600 hover:underline">Ver todas</Link>
            </div>
            {proximas.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">Nenhuma conta pendente</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {proximas.map((c) => {
                  const vencida = c.data_vencimento < hoje;
                  return (
                    <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <Link href={`/financeiro/contas/${c.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                          {c.descricao}
                        </Link>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.tipo === "pagar" ? "Pagar" : "Receber"} • Venc. {new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                          {vencida && <span className="text-rose-600 ml-1">(vencida)</span>}
                          {c.categoria && <span className="ml-1">• {c.categoria}</span>}
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${c.tipo === "pagar" ? "text-rose-600" : "text-emerald-600"}`}>
                        {c.tipo === "pagar" ? "-" : "+"}{fmt(c.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
