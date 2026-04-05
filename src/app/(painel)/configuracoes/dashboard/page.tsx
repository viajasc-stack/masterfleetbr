"use client";

import { useEffect, useState } from "react";
import {
  DASHBOARD_CONFIG_DEFAULTS,
  DASHBOARD_CONFIG_LABELS,
  mergeDashboardConfig,
  readDashboardConfigLocal,
  type DashboardConfig,
  writeDashboardConfigLocal,
} from "@/lib/dashboardConfig";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { supabase } from "@/lib/supabase/client";

export default function ConfiguracoesDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [config, setConfig] = useState<DashboardConfig>(DASHBOARD_CONFIG_DEFAULTS);
  const [canConfigurarWidgetFinanceiro, setCanConfigurarWidgetFinanceiro] = useState(false);
  const [canConfigurarWidgetManutencao, setCanConfigurarWidgetManutencao] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMsg("");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileError || !profile?.empresa_id) {
        setMsg(profileError?.message ?? "Empresa não encontrada para este usuário.");
        setLoading(false);
        return;
      }

      setEmpresaId(profile.empresa_id);

      const localCfg = readDashboardConfigLocal(profile.empresa_id);
      if (localCfg) setConfig(localCfg);

      const access = await loadEmpresaModuleAccess();
      const financeiroAtivo = access.canUseAllModules || access.allowedModules.includes("financeiro");
      const manutencaoAtiva = access.canUseAllModules || access.allowedModules.includes("manutencao");
      setCanConfigurarWidgetFinanceiro(financeiroAtivo);
      setCanConfigurarWidgetManutencao(manutencaoAtiva);

      const { data: empresaData, error: empresaError } = await supabase
        .from("empresas")
        .select("dashboard_config")
        .eq("id", profile.empresa_id)
        .maybeSingle();

      if (empresaError) {
        if (localCfg) {
          setMsg("Configuração carregada localmente. Aplique a migration do dashboard_config para sincronizar com o banco.");
        } else {
          setMsg(`Erro ao carregar configurações: ${empresaError.message}`);
        }
        setLoading(false);
        return;
      }

      const merged = mergeDashboardConfig(empresaData?.dashboard_config);

      // Se já existe configuração local, ela vira fonte de verdade para não
      // "voltar" para defaults quando o banco estiver desatualizado.
      if (!localCfg) {
        setConfig(merged);
        writeDashboardConfigLocal(profile.empresa_id, merged);
      }
      setLoading(false);
    }

    void load();
  }, []);

  function toggle(key: keyof DashboardConfig) {
    setConfig((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (empresaId) writeDashboardConfigLocal(empresaId, next);
      return next;
    });
  }

  async function salvar() {
    if (!empresaId) return;

    setSaving(true);
    setMsg("");

    const { error } = await supabase
      .from("empresas")
      .update({ dashboard_config: config })
      .eq("id", empresaId);

    setSaving(false);

    if (error) {
      writeDashboardConfigLocal(empresaId, config);
      setMsg("Configuração salva localmente. Aplique a migration do dashboard_config para persistir no banco.");
      return;
    }

    writeDashboardConfigLocal(empresaId, config);
    setMsg("Configurações do dashboard salvas com sucesso.");
  }

  if (loading) return <div className="text-slate-500 text-sm">Carregando configurações do dashboard...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configurações do Dashboard</h1>
        <p className="text-slate-600 text-sm mt-0.5">
          Ative ou desative os blocos que devem aparecer no dashboard da empresa.
        </p>
      </div>

      {msg ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            msg.startsWith("Erro")
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {msg}
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        {!canConfigurarWidgetFinanceiro ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            O widget financeiro só fica disponível quando o módulo Financeiro estiver ativo para a empresa.
          </div>
        ) : null}

        {!canConfigurarWidgetManutencao ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            O widget de manutenção só fica disponível quando o módulo Manutenção estiver ativo para a empresa.
          </div>
        ) : null}

        <div className="space-y-3">
          {DASHBOARD_CONFIG_LABELS.filter(
            (item) =>
              (item.key !== "widget_financeiro_resumo" || canConfigurarWidgetFinanceiro) &&
              (item.key !== "widget_manutencao_resumo" || canConfigurarWidgetManutencao)
          ).map((item) => {
            const ativo = config[item.key];
            return (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 bg-slate-50/50"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                </div>

                <button
                  type="button"
                  onClick={() => toggle(item.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    ativo ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                  aria-label={`${ativo ? "Desativar" : "Ativar"} ${item.label}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      ativo ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setConfig(DASHBOARD_CONFIG_DEFAULTS);
              if (empresaId) writeDashboardConfigLocal(empresaId, DASHBOARD_CONFIG_DEFAULTS);
            }}
            className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Restaurar padrão
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
