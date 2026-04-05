"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Billing = {
  status: string;
  billing_model?: string | null;
  valor_total_centavos?: number | null;
  modulos_ativos?: string[];
  proxima_cobranca?: string | null;
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

const HIDDEN_MODULE_CODES = new Set(["api_integracoes", "automacoes"]);

export default function MeuPlanoPage() {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [savingModulo, setSavingModulo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const modulosAtivos = useMemo(() => modulos.filter((m) => m.ativo_empresa), [modulos]);

  function moeda(v?: number | null) {
    return ((v ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function carregar() {
    setLoading(true);
    setErro(null);

    const [{ data: billingData, error: billingErr }, { data: catalogoData, error: catalogoErr }] = await Promise.all([
      supabase.rpc("get_billing_current"),
      supabase.rpc("get_my_module_catalog"),
    ]);

    if (billingErr || catalogoErr) {
      setErro(billingErr?.message || catalogoErr?.message || "Falha ao carregar plano.");
      setLoading(false);
      return;
    }

    setBilling({
      status: billingData?.status ?? "trial",
      billing_model: billingData?.billing_model ?? "modular",
      valor_total_centavos: billingData?.valor_total_centavos ?? null,
      modulos_ativos: Array.isArray(billingData?.modulos_ativos)
        ? billingData.modulos_ativos.map((m: unknown) => String(m))
        : [],
      proxima_cobranca: billingData?.proxima_cobranca ?? null,
    });
    const catalogo = ((catalogoData as Modulo[]) ?? []).filter(
      (m) => !HIDDEN_MODULE_CODES.has(m.codigo),
    );
    setModulos(catalogo);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);

    return () => clearTimeout(t);
  }, []);

  async function toggleModulo(modulo: Modulo) {
    setSavingModulo(modulo.codigo);
    setErro(null);
    setMsg(null);

    const { data, error } = await supabase.rpc("toggle_my_module_subscription", {
      p_modulo_codigo: modulo.codigo,
      p_ativo: !modulo.ativo_empresa,
    });

    if (error || !data) {
      setErro(error?.message ?? "Não foi possível alterar o módulo.");
      setSavingModulo(null);
      return;
    }

    setMsg(`Módulo ${modulo.nome} ${modulo.ativo_empresa ? "removido" : "adicionado"} com sucesso.`);
    await carregar();
    setSavingModulo(null);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Meu plano</h1>
          <p className="text-sm text-slate-600 mt-1">
            Aqui você vê os módulos ativos da sua empresa e pode adicionar/remover módulos extras.
          </p>
        </div>
        <Link href="/financeiro" className="text-sm text-indigo-600 hover:text-indigo-700">
          Ir para financeiro
        </Link>
      </div>

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {msg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando plano...</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-500">Status</div>
              <div className="text-slate-900 font-medium mt-1 capitalize">{billing?.status ?? "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">Modelo</div>
              <div className="text-slate-900 font-medium mt-1 capitalize">{billing?.billing_model ?? "modular"}</div>
            </div>
            <div>
              <div className="text-slate-500">Valor mensal</div>
              <div className="text-slate-900 font-medium mt-1">{moeda(billing?.valor_total_centavos)}</div>
            </div>
            <div className="md:col-span-3">
              <div className="text-slate-500">Próxima cobrança</div>
              <div className="text-slate-900 font-medium mt-1">
                {billing?.proxima_cobranca ? new Date(billing.proxima_cobranca).toLocaleDateString("pt-BR") : "—"}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-lg font-semibold text-slate-900">Módulos ativos no momento</h2>
            {modulosAtivos.length === 0 ? (
              <p className="text-sm text-slate-500 mt-2">Nenhum módulo ativo.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {modulosAtivos.map((m) => (
                  <span key={m.codigo} className="text-xs px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
                    {m.nome}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <h2 className="text-lg font-semibold text-slate-900">Adicionar ou remover módulos</h2>
            <p className="text-sm text-slate-500 mt-1">
              Módulos base são obrigatórios para funcionamento da plataforma. Módulos extras podem ser ativados/desativados.
            </p>

            <div className="grid md:grid-cols-2 gap-3 mt-4">
              {modulos.map((m) => (
                <div key={m.codigo} className="rounded-lg border border-slate-200 p-3 bg-slate-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{m.nome}</div>
                      <div className="text-xs text-slate-500 mt-1">{m.descricao || m.codigo}</div>
                      <div className="text-xs text-slate-500 mt-1">{m.categoria || "geral"} • {moeda(m.preco_centavos)}/mês</div>
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
                          ? "Módulo base"
                          : m.ativo_empresa
                            ? "Excluir módulo"
                            : "Adicionar módulo"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
