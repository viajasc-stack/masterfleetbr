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
        .limit(50);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Financeiro</h1>
          <p className="text-slate-400 mt-0.5 text-sm">Contas a pagar e a receber</p>
        </div>
        <Link href="/financeiro/contas/nova" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">
          + Nova Conta
        </Link>
      </div>

      {billing && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-600">Assinatura</span>
            <span className={`ml-2 text-xs px-2 py-1 rounded border ${
              billing.status === "ativa" ? "border-green-200 text-green-700 bg-green-50"
              : billing.status === "trial" ? "border-blue-200 text-blue-700 bg-blue-50"
              : billing.status === "past_due" ? "border-amber-200 text-amber-700 bg-amber-50"
              : "border-red-200 text-red-700 bg-red-50"
            }`}>{billing.status}</span>
            {billing.plano_nome && <span className="ml-2 text-slate-600">Plano: <span className="text-slate-900 font-medium">{billing.plano_nome}</span></span>}
            {billing.proxima_cobranca && <span className="ml-2 text-slate-600">Próx.: <span className="text-slate-900">{new Date(billing.proxima_cobranca).toLocaleDateString("pt-BR")}</span></span>}
            {billing.trial_ate && <span className="ml-2 text-slate-600">Trial: <span className="text-slate-900">{new Date(billing.trial_ate).toLocaleDateString("pt-BR")}</span></span>}
          </div>
          {(billing.status === "past_due" || billing.status === "bloqueada") && (
            <Link href="/bloqueado" className="text-xs text-amber-700 hover:underline">Regularizar</Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
              <div className="text-2xl font-bold text-white">{fmt(resumo.total_pagar)}</div>
              <div className="text-sm text-slate-400 mt-1">A Pagar ({resumo.a_pagar})</div>
              {resumo.vencidas_pagar > 0 && <div className="text-xs text-red-400 mt-1">{resumo.vencidas_pagar} vencida(s)</div>}
            </div>
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5">
              <div className="text-2xl font-bold text-white">{fmt(resumo.total_receber)}</div>
              <div className="text-sm text-slate-400 mt-1">A Receber ({resumo.a_receber})</div>
              {resumo.vencidas_receber > 0 && <div className="text-xs text-amber-400 mt-1">{resumo.vencidas_receber} vencida(s)</div>}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
              <div className={`text-2xl font-bold ${resumo.total_receber - resumo.total_pagar >= 0 ? "text-green-400" : "text-red-400"}`}>
                {fmt(resumo.total_receber - resumo.total_pagar)}
              </div>
              <div className="text-sm text-slate-400 mt-1">Saldo Projetado</div>
            </div>
            <Link href="/financeiro/contas/nova" className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 hover:bg-slate-700/60 transition flex flex-col justify-center">
              <div className="text-sm font-semibold text-white">Nova Conta</div>
              <div className="text-xs text-slate-400 mt-0.5">Pagar ou receber</div>
            </Link>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Próximos vencimentos</span>
              <Link href="/financeiro/contas" className="text-xs text-sky-400 hover:underline">Ver todas</Link>
            </div>
            {proximas.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">Nenhuma conta pendente</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {proximas.map((c) => {
                  const vencida = c.data_vencimento < hoje;
                  return (
                    <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <Link href={`/financeiro/contas/${c.id}`} className="text-sm font-medium text-white hover:underline">
                          {c.descricao}
                        </Link>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.tipo === "pagar" ? "Pagar" : "Receber"} • Venc. {new Date(c.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                          {vencida && <span className="text-red-400 ml-1">(vencida)</span>}
                          {c.categoria && <span className="ml-1">• {c.categoria}</span>}
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${c.tipo === "pagar" ? "text-red-400" : "text-green-400"}`}>
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
