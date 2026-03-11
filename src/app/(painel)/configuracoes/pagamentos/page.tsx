"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type EmpresaPagamentos = {
  id: string;
  mercado_pago_ativo: boolean;
  mp_public_key: string | null;
  mp_access_token: string | null;
  mp_webhook_secret: string | null;
  asaas_ativo: boolean;
  asaas_api_key: string | null;
  asaas_webhook_secret: string | null;
  asaas_api_url: string | null;
};

export default function ConfiguracoesPagamentosPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    mercado_pago_ativo: false,
    mp_public_key: "",
    mp_access_token: "",
    mp_webhook_secret: "",
    asaas_ativo: false,
    asaas_api_key: "",
    asaas_webhook_secret: "",
    asaas_api_url: "https://api.asaas.com/v3",
  });

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        setMsg("Sessão não encontrada.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const empId = profile?.empresa_id ?? null;
      setEmpresaId(empId);
      if (!empId) {
        setMsg("Usuário sem empresa vinculada.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("empresas")
        .select("id,mercado_pago_ativo,mp_public_key,mp_access_token,mp_webhook_secret,asaas_ativo,asaas_api_key,asaas_webhook_secret,asaas_api_url")
        .eq("id", empId)
        .maybeSingle();

      if (error || !data) {
        setMsg(`Erro ao carregar dados: ${error?.message ?? "empresa não encontrada"}`);
        setLoading(false);
        return;
      }

      const e = data as EmpresaPagamentos;
      setForm({
        mercado_pago_ativo: Boolean(e.mercado_pago_ativo),
        mp_public_key: e.mp_public_key ?? "",
        mp_access_token: e.mp_access_token ?? "",
        mp_webhook_secret: e.mp_webhook_secret ?? "",
        asaas_ativo: Boolean(e.asaas_ativo),
        asaas_api_key: e.asaas_api_key ?? "",
        asaas_webhook_secret: e.asaas_webhook_secret ?? "",
        asaas_api_url: e.asaas_api_url ?? "https://api.asaas.com/v3",
      });

      setLoading(false);
    }

    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresaId) return;
    setSaving(true);
    setMsg("");

    const payload = {
      mercado_pago_ativo: form.mercado_pago_ativo,
      mp_public_key: form.mp_public_key.trim() || null,
      mp_access_token: form.mp_access_token.trim() || null,
      mp_webhook_secret: form.mp_webhook_secret.trim() || null,
      asaas_ativo: form.asaas_ativo,
      asaas_api_key: form.asaas_api_key.trim() || null,
      asaas_webhook_secret: form.asaas_webhook_secret.trim() || null,
      asaas_api_url: form.asaas_api_url.trim() || null,
    };

    const { error } = await supabase.from("empresas").update(payload).eq("id", empresaId);
    setSaving(false);

    if (error) {
      setMsg(`Erro ao salvar: ${error.message}`);
      return;
    }

    setMsg("Configurações de pagamento salvas com sucesso.");
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando configurações...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-white">Configurações de Pagamento</h1>
        <p className="text-slate-400 text-sm mt-0.5">Gerencie Mercado Pago e Asaas da sua empresa.</p>
      </div>

      {msg ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${msg.startsWith("Erro") ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-green-500/30 bg-green-500/10 text-green-300"}`}>
          {msg}
        </div>
      ) : null}

      <form onSubmit={salvar} className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Mercado Pago</h2>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.mercado_pago_ativo}
                onChange={(e) => setForm((p) => ({ ...p, mercado_pago_ativo: e.target.checked }))}
              />
              Ativo
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Public Key" value={form.mp_public_key} onChange={(v) => setForm((p) => ({ ...p, mp_public_key: v }))} />
            <Field label="Access Token" value={form.mp_access_token} onChange={(v) => setForm((p) => ({ ...p, mp_access_token: v }))} />
            <div className="md:col-span-2">
              <Field label="Webhook Secret" value={form.mp_webhook_secret} onChange={(v) => setForm((p) => ({ ...p, mp_webhook_secret: v }))} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Asaas</h2>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.asaas_ativo}
                onChange={(e) => setForm((p) => ({ ...p, asaas_ativo: e.target.checked }))}
              />
              Ativo
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="API Key" value={form.asaas_api_key} onChange={(v) => setForm((p) => ({ ...p, asaas_api_key: v }))} />
            <Field label="Webhook Secret" value={form.asaas_webhook_secret} onChange={(v) => setForm((p) => ({ ...p, asaas_webhook_secret: v }))} />
            <div className="md:col-span-2">
              <Field label="API URL" value={form.asaas_api_url} onChange={(v) => setForm((p) => ({ ...p, asaas_api_url: v }))} placeholder="https://api.asaas.com/v3" />
            </div>
          </div>
        </section>

        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar configurações"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        className="w-full border border-slate-300 rounded-md px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
