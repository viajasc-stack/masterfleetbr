"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getAccessTokenOrThrow } from "@/lib/financeiro";

type MasterIAConfig = {
  enabled: boolean;
  openai_model: string;
  temperature: number;
  auto_scan_enabled: boolean;
  scan_interval_min: number;
  alert_channel_inapp: boolean;
};

const DEFAULTS: MasterIAConfig = {
  enabled: true,
  openai_model: "gpt-4.1-mini",
  temperature: 0.2,
  auto_scan_enabled: true,
  scan_interval_min: 5,
  alert_channel_inapp: true,
};

export default function MasterIAConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openAiConfigured, setOpenAiConfigured] = useState(false);
  const [msg, setMsg] = useState("");
  const [config, setConfig] = useState<MasterIAConfig>(DEFAULTS);

  async function carregar() {
    setLoading(true);
    setMsg("");
    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch("/api/masteria/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        config?: MasterIAConfig;
        openai_configured?: boolean;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "Falha ao carregar configurações do MasterIA.");
      setConfig(data.config ?? DEFAULTS);
      setOpenAiConfigured(Boolean(data.openai_configured));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao carregar configurações do MasterIA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch("/api/masteria/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar configurações do MasterIA.");
      setMsg("Configurações do MasterIA salvas com sucesso.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao salvar configurações do MasterIA.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Configurações • MasterIA</h1>
          <p className="text-sm text-slate-600 mt-0.5">Parâmetros globais da IA operacional da plataforma.</p>
        </div>
        <Link href="/master/configuracoes" className="text-sm text-slate-600 hover:text-slate-900 underline">
          Voltar
        </Link>
      </div>

      {msg ? <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm text-slate-700">
              OpenAI configurado no ambiente: <strong>{openAiConfigured ? "Sim" : "Não"}</strong>
            </div>
            {!openAiConfigured ? (
              <div className="text-xs text-amber-700 mt-2">
                Defina a variável <code>OPENAI_API_KEY</code> no ambiente para habilitar respostas do chat.
              </div>
            ) : null}
          </div>

          <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
              />
              MasterIA habilitada
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.auto_scan_enabled}
                onChange={(e) => setConfig((p) => ({ ...p, auto_scan_enabled: e.target.checked }))}
              />
              Scan automático de conflitos (OS/veículo)
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={config.alert_channel_inapp}
                onChange={(e) => setConfig((p) => ({ ...p, alert_channel_inapp: e.target.checked }))}
              />
              Alertas no painel (in-app)
            </label>

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Modelo OpenAI</label>
                <input
                  value={config.openai_model}
                  onChange={(e) => setConfig((p) => ({ ...p, openai_model: e.target.value }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Temperatura (0 a 1)</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={String(config.temperature)}
                  onChange={(e) => setConfig((p) => ({ ...p, temperature: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Intervalo scan (min)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={String(config.scan_interval_min)}
                  onChange={(e) => setConfig((p) => ({ ...p, scan_interval_min: Number(e.target.value) }))}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <button disabled={saving} className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar MasterIA"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
