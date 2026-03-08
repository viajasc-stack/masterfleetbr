"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Billing = {
  status: string;
  plano_id?: string | null;
  plano_nome?: string | null;
  trial_ate?: string | null;
  proxima_cobranca?: string | null;
  fatura_id?: string | null;
  valor_centavos?: number | null;
  fatura_status?: string | null;
  vencimento?: string | null;
};

type Plano = {
  id: string;
  nome: string;
  valor_centavos: number;
};

export default function AssinaturaPage() {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [savingPlano, setSavingPlano] = useState(false);
  const [msgPlano, setMsgPlano] = useState<string | null>(null);
  const [savingFatura, setSavingFatura] = useState(false);
  const [msgFatura, setMsgFatura] = useState<string | null>(null);

  async function carregarBilling() {
    const { data: billingAtualizado } = await supabase.rpc("get_billing_current");
    if (!billingAtualizado) return;

    setBilling({
      status: billingAtualizado.status ?? "trial",
      plano_id: billingAtualizado.plano_id ?? null,
      plano_nome: billingAtualizado.plano_nome ?? null,
      trial_ate: billingAtualizado.trial_ate ?? null,
      proxima_cobranca: billingAtualizado.proxima_cobranca ?? null,
      fatura_id: billingAtualizado.fatura_id ?? null,
      valor_centavos: billingAtualizado.valor_centavos ?? null,
      fatura_status: billingAtualizado.fatura_status ?? null,
      vencimento: billingAtualizado.vencimento ?? null,
    });
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data }, { data: planosData }] = await Promise.all([
        supabase.rpc("get_billing_current"),
        supabase.from("planos").select("id, nome, valor_centavos").eq("ativo", true).order("ordem", { ascending: true }),
      ]);

      setPlanos((planosData as Plano[]) ?? []);

      if (data) {
        setBilling({
          status: data.status ?? "trial",
          plano_id: data.plano_id ?? null,
          plano_nome: data.plano_nome ?? null,
          trial_ate: data.trial_ate ?? null,
          proxima_cobranca: data.proxima_cobranca ?? null,
          fatura_id: data.fatura_id ?? null,
          valor_centavos: data.valor_centavos ?? null,
          fatura_status: data.fatura_status ?? null,
          vencimento: data.vencimento ?? null,
        });
      }
      setLoading(false);
    }
    void load();
  }, []);

  const statusStyle = (status?: string | null) => {
    if (status === "ativa") return "border-emerald-200 text-emerald-700 bg-emerald-50";
    if (status === "trial") return "border-indigo-200 text-indigo-700 bg-indigo-50";
    if (status === "past_due") return "border-amber-200 text-amber-700 bg-amber-50";
    return "border-rose-200 text-rose-700 bg-rose-50";
  };

  const fmt = (v?: number | null) => ((v ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function alterarPlano(planoId: string) {
    setSavingPlano(true);
    setMsgPlano(null);

    const { data, error } = await supabase.rpc("change_my_plan", { p_plano_id: planoId });

    if (error || !data) {
      setMsgPlano(`Erro ao alterar plano: ${error?.message ?? "não foi possível concluir."}`);
      setSavingPlano(false);
      return;
    }

    await carregarBilling();

    setMsgPlano("Plano alterado com sucesso.");
    setSavingPlano(false);
  }

  async function gerarFaturaManual() {
    setSavingFatura(true);
    setMsgFatura(null);

    const { data, error } = await supabase.rpc("generate_my_manual_invoice");

    if (error || !data) {
      setMsgFatura(`Erro ao gerar fatura: ${error?.message ?? "não foi possível concluir."}`);
      setSavingFatura(false);
      return;
    }

    await carregarBilling();
    setMsgFatura(`Fatura pronta (ID: ${String(data)}).`);
    setSavingFatura(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Assinatura</h1>
          <p className="text-sm text-slate-500 mt-0.5">Acompanhe o plano e situação da cobrança da sua empresa.</p>
        </div>
        <Link href="/financeiro/faturas" className="text-sm text-indigo-600 hover:underline">
          Ver faturas
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : !billing ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Não foi possível carregar os dados da assinatura.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Status:</span>
              <span className={`text-xs px-2 py-1 rounded border ${statusStyle(billing.status)}`}>{billing.status}</span>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <div className="text-slate-500">Plano atual</div>
                <div className="font-semibold text-slate-900 mt-1">{billing.plano_nome ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-500">Trial até</div>
                <div className="font-semibold text-slate-900 mt-1">
                  {billing.trial_ate ? new Date(billing.trial_ate).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Próxima cobrança</div>
                <div className="font-semibold text-slate-900 mt-1">
                  {billing.proxima_cobranca ? new Date(billing.proxima_cobranca).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="text-sm font-medium text-slate-800 mb-2">Alterar plano</div>
              {planos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum plano ativo disponível no momento.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {planos.map((p) => {
                    const selecionado = billing.plano_id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => alterarPlano(p.id)}
                        disabled={savingPlano || selecionado}
                        className={`px-3 py-2 rounded-md text-sm border transition ${
                          selecionado
                            ? "border-slate-300 text-slate-400 bg-slate-50 cursor-default"
                            : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        }`}
                      >
                        {p.nome} ({fmt(p.valor_centavos)}/mês)
                      </button>
                    );
                  })}
                </div>
              )}

              {msgPlano && <p className="text-xs text-slate-600 mt-2">{msgPlano}</p>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Fatura atual</h2>
            {billing.fatura_id ? (
              <div className="mt-3 text-sm space-y-1">
                <div className="text-slate-600">ID: <span className="font-mono text-slate-800">{billing.fatura_id}</span></div>
                <div className="text-slate-600">Valor: <span className="font-semibold text-slate-900">{fmt(billing.valor_centavos)}</span></div>
                <div className="text-slate-600">Status da fatura: <span className="font-medium text-slate-900">{billing.fatura_status ?? "—"}</span></div>
                <div className="text-slate-600">Vencimento: <span className="font-medium text-slate-900">{billing.vencimento ? new Date(billing.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</span></div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2">Sem fatura em aberto no momento.</p>
            )}

            <div className="mt-4 flex gap-2">
              <Link href="/financeiro/faturas" className="px-4 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-500">
                Ir para pagamentos
              </Link>
              <button
                type="button"
                onClick={gerarFaturaManual}
                disabled={savingFatura}
                className="px-4 py-2 rounded-md text-sm border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >
                {savingFatura ? "Gerando..." : "Gerar fatura manual"}
              </button>
              {(billing.status === "past_due" || billing.status === "bloqueada") && (
                <Link href="/bloqueado" className="px-4 py-2 rounded-md text-sm border border-amber-300 text-amber-700 hover:bg-amber-50">
                  Regularizar agora
                </Link>
              )}
            </div>
            {msgFatura && <p className="text-xs text-slate-600 mt-2">{msgFatura}</p>}
          </div>
        </>
      )}
    </div>
  );
}
