"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { financeiroErrorMessage } from "@/lib/financeiro";
import { supabase } from "@/lib/supabase/client";
import { logError, logInfo } from "@/lib/observability";

type Billing = {
  status: string;
  billing_model?: string | null;
  plano_id?: string | null;
  plano_nome?: string | null;
  trial_ate?: string | null;
  proxima_cobranca?: string | null;
  valor_total_centavos?: number | null;
  modulos_ativos?: string[];
  fatura_id?: string | null;
  valor_centavos?: number | null;
  fatura_status?: string | null;
  vencimento?: string | null;
};

type Modulo = {
  codigo: string;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  preco_centavos: number;
  ativo_empresa: boolean;
  ativo_global: boolean;
  venda_ativa: boolean;
  base_obrigatoria: boolean;
};

export default function AssinaturaPage() {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [savingModulo, setSavingModulo] = useState<string | null>(null);
  const [msgModulo, setMsgModulo] = useState<string | null>(null);
  const [savingFatura, setSavingFatura] = useState(false);
  const [msgFatura, setMsgFatura] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregarBilling() {
    const { data: billingAtualizado, error } = await supabase.rpc("get_billing_current");
    if (error) throw error;
    if (!billingAtualizado) return;

    setBilling({
      status: billingAtualizado.status ?? "trial",
      billing_model: billingAtualizado.billing_model ?? "modular",
      plano_id: billingAtualizado.plano_id ?? null,
      plano_nome: billingAtualizado.plano_nome ?? null,
      trial_ate: billingAtualizado.trial_ate ?? null,
      proxima_cobranca: billingAtualizado.proxima_cobranca ?? null,
      valor_total_centavos: billingAtualizado.valor_total_centavos ?? null,
      modulos_ativos: Array.isArray(billingAtualizado.modulos_ativos)
        ? billingAtualizado.modulos_ativos.map((m: unknown) => String(m))
        : [],
      fatura_id: billingAtualizado.fatura_id ?? null,
      valor_centavos: billingAtualizado.valor_centavos ?? null,
      fatura_status: billingAtualizado.fatura_status ?? null,
      vencimento: billingAtualizado.vencimento ?? null,
    });
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro(null);
      try {
        const [{ data, error: billingErr }, { data: modulosData, error: modulosErr }] = await Promise.all([
          supabase.rpc("get_billing_current"),
          supabase.rpc("get_my_module_catalog"),
        ]);

        if (billingErr) throw billingErr;
        if (modulosErr) throw modulosErr;

        setModulos((modulosData as Modulo[]) ?? []);

        if (data) {
          setBilling({
            status: data.status ?? "trial",
            billing_model: data.billing_model ?? "modular",
            plano_id: data.plano_id ?? null,
            plano_nome: data.plano_nome ?? null,
            trial_ate: data.trial_ate ?? null,
            proxima_cobranca: data.proxima_cobranca ?? null,
            valor_total_centavos: data.valor_total_centavos ?? null,
            modulos_ativos: Array.isArray(data.modulos_ativos)
              ? data.modulos_ativos.map((m: unknown) => String(m))
              : [],
            fatura_id: data.fatura_id ?? null,
            valor_centavos: data.valor_centavos ?? null,
            fatura_status: data.fatura_status ?? null,
            vencimento: data.vencimento ?? null,
          });
        }
      } catch (e) {
        logError("financeiro.assinatura", "Falha ao carregar dados de assinatura", e);
        setErro(financeiroErrorMessage(e, "Falha ao carregar dados de assinatura."));
      } finally {
        setLoading(false);
      }
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

  const hasOperationalModule = modulos.some((m) => m.codigo === "operacional" && m.ativo_empresa);

  async function toggleModulo(modulo: Modulo) {
    setSavingModulo(modulo.codigo);
    setMsgModulo(null);
    setErro(null);

    const { data, error } = await supabase.rpc("toggle_my_module_subscription", {
      p_modulo_codigo: modulo.codigo,
      p_ativo: !modulo.ativo_empresa,
    });

    if (error || !data) {
      logError("financeiro.assinatura", "Erro ao alterar módulo", error, { modulo_codigo: modulo.codigo });
      setMsgModulo(financeiroErrorMessage(error, "Erro ao alterar módulo."));
      setSavingModulo(null);
      return;
    }

    try {
      await carregarBilling();
      const { data: modulosAtualizados, error: modulosErr } = await supabase.rpc("get_my_module_catalog");
      if (modulosErr) throw modulosErr;
      setModulos((modulosAtualizados as Modulo[]) ?? []);
    } catch (e) {
      logError("financeiro.assinatura", "Módulo alterado, mas falhou ao recarregar billing", e, { modulo_codigo: modulo.codigo });
      setErro(financeiroErrorMessage(e, "Módulo alterado, mas falhou ao recarregar resumo."));
    }

    logInfo("financeiro.assinatura", "Módulo alterado com sucesso", { modulo_codigo: modulo.codigo, ativo: !modulo.ativo_empresa });
    setMsgModulo(`Módulo ${modulo.nome} ${modulo.ativo_empresa ? "desativado" : "ativado"} com sucesso.`);
    setSavingModulo(null);
  }

  async function gerarFaturaManual() {
    setSavingFatura(true);
    setMsgFatura(null);
    setErro(null);

    const { data, error } = await supabase.rpc("generate_my_manual_invoice");

    if (error || !data) {
      logError("financeiro.assinatura", "Erro ao gerar fatura manual", error);
      setMsgFatura(financeiroErrorMessage(error, "Erro ao gerar fatura manual."));
      setSavingFatura(false);
      return;
    }

    try {
      await carregarBilling();
    } catch (e) {
      logError("financeiro.assinatura", "Fatura gerada, mas falhou ao recarregar billing", e, { fatura_id: String(data) });
      setErro(financeiroErrorMessage(e, "Fatura criada, mas falhou ao recarregar resumo."));
    }
    logInfo("financeiro.assinatura", "Fatura manual gerada", { fatura_id: String(data) });
    setMsgFatura(`Fatura pronta (ID: ${String(data)}).`);
    setSavingFatura(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-semibold text-slate-900">Assinatura modular</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gerencie os módulos contratados e a cobrança mensal da sua empresa.</p>
        </div>
        <Link href="/financeiro/faturas" className="text-sm text-indigo-600 hover:underline">
          Ver faturas
        </Link>
      </div>

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

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
                <div className="text-slate-500">Modelo</div>
                <div className="font-semibold text-slate-900 mt-1 capitalize">{billing.billing_model ?? "modular"}</div>
              </div>
              <div>
                <div className="text-slate-500">Valor mensal atual</div>
                <div className="font-semibold text-slate-900 mt-1">{fmt(billing.valor_total_centavos)}</div>
              </div>
              <div>
                <div className="text-slate-500">Próxima cobrança</div>
                <div className="font-semibold text-slate-900 mt-1">
                  {billing.proxima_cobranca ? new Date(billing.proxima_cobranca).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <div className="text-slate-500">Status</div>
                <div className="font-semibold text-slate-900 mt-1 capitalize">{billing.status}</div>
              </div>
              <div>
                <div className="text-slate-500">Trial até</div>
                <div className="font-semibold text-slate-900 mt-1">
                  {billing.trial_ate ? new Date(billing.trial_ate).toLocaleDateString("pt-BR") : "—"}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="text-sm font-medium text-slate-800 mb-2">Módulos contratáveis</div>
              {hasOperationalModule ? (
                <div className="mb-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                  <strong>Operacional</strong> é o módulo padrão da plataforma e já contempla dashboard, OS, veículos, motoristas, fretamentos, contratos e clientes.
                </div>
              ) : null}
              {modulos.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum módulo disponível no momento.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {modulos.map((m) => {
                    return (
                      <div key={m.codigo} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">{m.nome}</div>
                            <div className="text-xs text-slate-500 mt-1">{m.descricao ?? m.codigo}</div>
                            <div className="text-xs text-slate-500 mt-1">{m.categoria ?? "geral"} • {fmt(m.preco_centavos)}/mês</div>
                          </div>
                          <span className={`text-[11px] px-2 py-1 rounded border ${m.ativo_empresa ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                            {m.ativo_empresa ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => toggleModulo(m)}
                            disabled={savingModulo === m.codigo || m.base_obrigatoria || !m.ativo_global || !m.venda_ativa}
                            className={`px-3 py-2 rounded-md text-sm border transition ${
                              m.base_obrigatoria
                                ? "border-slate-200 text-slate-400 bg-slate-50 cursor-default"
                                : m.ativo_empresa
                                  ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                  : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            } disabled:opacity-60`}
                          >
                            {savingModulo === m.codigo
                              ? "Salvando..."
                              : m.base_obrigatoria
                                ? m.codigo === "operacional"
                                  ? "Módulo padrão"
                                  : "Módulo base"
                                : m.ativo_empresa
                                  ? "Desativar módulo"
                                  : "Ativar módulo"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {msgModulo && <p className="text-xs text-slate-600 mt-2">{msgModulo}</p>}
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
