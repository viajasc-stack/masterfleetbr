"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function MasterConfigMercadoPagoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    mercado_pago_ativo: false,
    mp_public_key: "",
    mp_access_token: "",
    mp_user_id: "",
    mp_app_id: "",
    mp_webhook_secret: "",
  });

  useEffect(() => {
    async function loadGlobalConfig() {
      setLoading(true);
      const { data } = await supabase
        .from("gateway_configs")
        .select("provider, ativo, public_key, access_token, user_id, app_id, webhook_secret")
        .eq("provider", "mercado_pago")
        .maybeSingle();

      if (data) {
        setForm({
          mercado_pago_ativo: data.ativo ?? false,
          mp_public_key: data.public_key ?? "",
          mp_access_token: data.access_token ?? "",
          mp_user_id: data.user_id ?? "",
          mp_app_id: data.app_id ?? "",
          mp_webhook_secret: data.webhook_secret ?? "",
        });
      }
      setLoading(false);
    }

    const id = setTimeout(() => {
      void loadGlobalConfig();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const { error } = await supabase
      .from("gateway_configs")
      .upsert({
        provider: "mercado_pago",
        ativo: form.mercado_pago_ativo,
        public_key: form.mp_public_key.trim() || null,
        access_token: form.mp_access_token.trim() || null,
        user_id: form.mp_user_id.trim() || null,
        app_id: form.mp_app_id.trim() || null,
        webhook_secret: form.mp_webhook_secret.trim() || null,
      });

    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Configurações globais de Mercado Pago salvas.");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Master • Mercado Pago</h1>
          <p className="text-sm text-slate-600 mt-0.5">Credenciais globais do gateway para o MasterFleet.</p>
        </div>
        <Link href="/master/configuracoes" className="text-sm text-slate-600 hover:text-slate-900 underline">
          Voltar
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          Como usuário Master, você define aqui as credenciais globais padrão do Mercado Pago.
        </p>
      </div>

      {msg && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${msg.startsWith("Erro") || msg.includes("não encontrada") ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : (
        <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.mercado_pago_ativo} onChange={(ev) => setForm((p) => ({ ...p, mercado_pago_ativo: ev.target.checked }))} />
            Ativar integração Mercado Pago global
          </label>

          <div className="grid gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Public Key</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.mp_public_key} onChange={(ev) => setForm((p) => ({ ...p, mp_public_key: ev.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Access Token</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.mp_access_token} onChange={(ev) => setForm((p) => ({ ...p, mp_access_token: ev.target.value }))} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">User ID</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.mp_user_id} onChange={(ev) => setForm((p) => ({ ...p, mp_user_id: ev.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">App ID</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.mp_app_id} onChange={(ev) => setForm((p) => ({ ...p, mp_app_id: ev.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Webhook Secret</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={form.mp_webhook_secret} onChange={(ev) => setForm((p) => ({ ...p, mp_webhook_secret: ev.target.value }))} />
            </div>
          </div>

          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </form>
      )}
    </div>
  );
}
