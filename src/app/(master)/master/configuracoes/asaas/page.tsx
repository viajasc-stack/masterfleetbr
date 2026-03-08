"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function MasterConfigAsaasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    ativo: false,
    api_url: "https://api.asaas.com/v3",
    access_token: "",
    webhook_secret: "",
  });

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      const { data } = await supabase
        .from("gateway_configs")
        .select("provider, ativo, api_url, access_token, webhook_secret")
        .eq("provider", "asaas")
        .maybeSingle();

      if (data) {
        setForm({
          ativo: data.ativo ?? false,
          api_url: data.api_url ?? "https://api.asaas.com/v3",
          access_token: data.access_token ?? "",
          webhook_secret: data.webhook_secret ?? "",
        });
      }
      setLoading(false);
    }

    void loadConfig();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const { error } = await supabase
      .from("gateway_configs")
      .upsert({
        provider: "asaas",
        ativo: form.ativo,
        api_url: form.api_url.trim() || "https://api.asaas.com/v3",
        access_token: form.access_token.trim() || null,
        webhook_secret: form.webhook_secret.trim() || null,
      });

    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Configurações globais de Asaas salvas.");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Master • Asaas</h1>
          <p className="text-sm text-slate-600 mt-0.5">Credenciais globais do Asaas para cobrança SaaS.</p>
        </div>
        <Link href="/master/configuracoes" className="text-sm text-slate-600 hover:text-slate-900 underline">
          Voltar
        </Link>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${msg.startsWith("Erro") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : (
        <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.ativo} onChange={(ev) => setForm((p) => ({ ...p, ativo: ev.target.checked }))} />
            Ativar Asaas como gateway preferencial
          </label>

          <div>
            <label className="block text-xs text-slate-500 mb-1">API URL</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.api_url} onChange={(ev) => setForm((p) => ({ ...p, api_url: ev.target.value }))} />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">API Key (access token)</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.access_token} onChange={(ev) => setForm((p) => ({ ...p, access_token: ev.target.value }))} />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Webhook Secret (opcional)</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.webhook_secret} onChange={(ev) => setForm((p) => ({ ...p, webhook_secret: ev.target.value }))} />
          </div>

          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </form>
      )}
    </div>
  );
}
