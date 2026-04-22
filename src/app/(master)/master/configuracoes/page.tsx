"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SuperAdmin = { user_id: string; email: string | null; created_at: string };
type FeatureFlag = {
  id: string;
  code: string;
  description: string | null;
  enabled: boolean;
  empresa_id: string | null;
  updated_at: string;
};

export default function MasterConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [novoEmailSuperAdmin, setNovoEmailSuperAdmin] = useState("");

  const [trialDias, setTrialDias] = useState("7");
  const [graceDias, setGraceDias] = useState("5");
  const [bloqueioAuto, setBloqueioAuto] = useState(true);
  const [referralActive, setReferralActive] = useState(false);
  const [inviterType, setInviterType] = useState<"fixed" | "percent">("fixed");
  const [inviterValue, setInviterValue] = useState("0");
  const [inviteeType, setInviteeType] = useState<"fixed" | "percent">("fixed");
  const [inviteeValue, setInviteeValue] = useState("0");

  const [flagCode, setFlagCode] = useState("");
  const [flagDescription, setFlagDescription] = useState("");
  const [flagEnabled, setFlagEnabled] = useState(true);

  async function carregar() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase.rpc("master_get_config_bundle");
    if (error || !data) {
      setMsg(error?.message ?? "Não foi possível carregar configurações master.");
      setLoading(false);
      return;
    }

    const payload = data as {
      super_admins?: SuperAdmin[];
      feature_flags?: FeatureFlag[];
      settings?: Record<string, unknown>;
    };

    setSuperAdmins(payload.super_admins ?? []);
    setFlags(payload.feature_flags ?? []);

    const settings = payload.settings ?? {};
    const billingPolicy = (settings.billing_policy as { trial_days?: number; grace_days?: number; auto_block?: boolean } | undefined) ?? {};
    const referralCampaign = (
      settings.referral_campaign as {
        active?: boolean;
        inviter?: { type?: "fixed" | "percent"; value?: number };
        invitee?: { type?: "fixed" | "percent"; value?: number };
      } | undefined
    ) ?? {};
    setTrialDias(String(billingPolicy.trial_days ?? 7));
    setGraceDias(String(billingPolicy.grace_days ?? 5));
    setBloqueioAuto(Boolean(billingPolicy.auto_block ?? true));
    setReferralActive(Boolean(referralCampaign.active ?? false));
    setInviterType(referralCampaign.inviter?.type === "percent" ? "percent" : "fixed");
    setInviterValue(String(referralCampaign.inviter?.value ?? 0));
    setInviteeType(referralCampaign.invitee?.type === "percent" ? "percent" : "fixed");
    setInviteeValue(String(referralCampaign.invitee?.value ?? 0));

    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function salvarPoliticaCobranca(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg("");
    const { error } = await supabase.rpc("master_upsert_setting", {
      p_key: "billing_policy",
      p_value: {
        trial_days: Number(trialDias || 7),
        grace_days: Number(graceDias || 5),
        auto_block: bloqueioAuto,
      },
    });
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Política de cobrança salva com sucesso.");
  }

  async function salvarCampanhaReferral(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg("");

    const { error } = await supabase.rpc("master_upsert_setting", {
      p_key: "referral_campaign",
      p_value: {
        active: referralActive,
        inviter: {
          type: inviterType,
          value: Number(inviterValue || 0),
        },
        invitee: {
          type: inviteeType,
          value: Number(inviteeValue || 0),
        },
      },
    });

    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Campanha Convide e Ganhe salva com sucesso.");
  }

  async function adicionarSuperAdmin(ev: FormEvent) {
    ev.preventDefault();
    if (!novoEmailSuperAdmin.trim()) return;
    setSaving(true);
    setMsg("");
    const { error } = await supabase.rpc("master_add_super_admin_by_email", { p_email: novoEmailSuperAdmin.trim() });
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setNovoEmailSuperAdmin("");
    await carregar();
    setMsg("Super admin adicionado.");
  }

  async function removerSuperAdmin(userId: string) {
    setSaving(true);
    setMsg("");
    const { error } = await supabase.rpc("master_remove_super_admin", { p_user_id: userId });
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    await carregar();
    setMsg("Super admin removido.");
  }

  async function salvarFlag(ev: FormEvent) {
    ev.preventDefault();
    if (!flagCode.trim()) return;
    setSaving(true);
    setMsg("");
    const { error } = await supabase.rpc("master_upsert_feature_flag", {
      p_code: flagCode.trim(),
      p_description: flagDescription.trim() || null,
      p_enabled: flagEnabled,
      p_empresa_id: null,
    });
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setFlagCode("");
    setFlagDescription("");
    setFlagEnabled(true);
    await carregar();
    setMsg("Feature flag salva.");
  }

  async function toggleFlag(flag: FeatureFlag) {
    const { error } = await supabase.rpc("master_upsert_feature_flag", {
      p_id: flag.id,
      p_code: flag.code,
      p_description: flag.description,
      p_enabled: !flag.enabled,
      p_empresa_id: flag.empresa_id,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    await carregar();
  }

  async function excluirFlag(id: string) {
    const { error } = await supabase.rpc("master_delete_feature_flag", { p_id: id });
    if (error) {
      setMsg(error.message);
      return;
    }
    await carregar();
  }

  const totalFlagsAtivas = useMemo(() => flags.filter((f) => f.enabled).length, [flags]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Configurações Master</h1>
          <p className="text-sm text-slate-600 mt-0.5">Segurança, governança de plataforma e parâmetros globais.</p>
        </div>
        <button onClick={carregar} className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">
          Recarregar
        </button>
      </div>

      {msg && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Super admins</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{superAdmins.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Feature flags</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{flags.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Flags ativas</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalFlagsAtivas}</div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Segurança • Super Admins</h2>
        {loading ? <div className="text-sm text-slate-500">Carregando...</div> : null}

        <form onSubmit={adicionarSuperAdmin} className="flex gap-2">
          <input
            value={novoEmailSuperAdmin}
            onChange={(e) => setNovoEmailSuperAdmin(e.target.value)}
            placeholder="email do usuário para virar super admin"
            className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <button disabled={saving} className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 disabled:opacity-60">
            Adicionar
          </button>
        </form>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
          {superAdmins.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">Nenhum super admin encontrado.</div>
          ) : (
            superAdmins.map((sa) => (
              <div key={sa.user_id} className="p-3 flex items-center justify-between text-sm">
                <div>
                  <div className="text-slate-900 font-medium">{sa.email ?? sa.user_id}</div>
                  <div className="text-xs text-slate-500">Criado em {new Date(sa.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <button onClick={() => removerSuperAdmin(sa.user_id)} className="text-xs text-rose-700 hover:underline">
                  Remover
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Plataforma • Política de Cobrança</h2>
        <form onSubmit={salvarPoliticaCobranca} className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Trial padrão (dias)</label>
            <input type="number" value={trialDias} onChange={(e) => setTrialDias(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Grace period (dias)</label>
            <input type="number" value={graceDias} onChange={(e) => setGraceDias(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={bloqueioAuto} onChange={(e) => setBloqueioAuto(e.target.checked)} />
            Bloqueio automático por inadimplência
          </label>
          <div className="md:col-span-3">
            <button disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60">
              Salvar política
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Plataforma • Convide e Ganhe</h2>
        <form onSubmit={salvarCampanhaReferral} className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={referralActive} onChange={(e) => setReferralActive(e.target.checked)} />
            Campanha ativa
          </label>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="text-sm font-medium text-slate-900">Quem convida (Empresa A)</div>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={inviterType}
                onChange={(e) => setInviterType(e.target.value === "percent" ? "percent" : "fixed")}
              >
                <option value="fixed">Valor fixo (R$)</option>
                <option value="percent">Percentual (%)</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={inviterValue}
                onChange={(e) => setInviterValue(e.target.value)}
                placeholder={inviterType === "fixed" ? "Ex.: 100" : "Ex.: 50"}
              />
            </div>

            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="text-sm font-medium text-slate-900">Quem é convidado (Empresa B)</div>
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={inviteeType}
                onChange={(e) => setInviteeType(e.target.value === "percent" ? "percent" : "fixed")}
              >
                <option value="fixed">Valor fixo (R$)</option>
                <option value="percent">Percentual (%)</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={inviteeValue}
                onChange={(e) => setInviteeValue(e.target.value)}
                placeholder={inviteeType === "fixed" ? "Ex.: 100" : "Ex.: 50"}
              />
            </div>
          </div>

          <button disabled={saving} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60">
            Salvar campanha
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Governança • Feature Flags</h2>
        <form onSubmit={salvarFlag} className="grid md:grid-cols-4 gap-3">
          <input value={flagCode} onChange={(e) => setFlagCode(e.target.value)} placeholder="code (ex: beta_novo_dashboard)" className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input value={flagDescription} onChange={(e) => setFlagDescription(e.target.value)} placeholder="descrição" className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={flagEnabled} onChange={(e) => setFlagEnabled(e.target.checked)} />
            Ativa
          </label>
          <div className="md:col-span-4">
            <button disabled={saving} className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 disabled:opacity-60">
              Salvar feature flag
            </button>
          </div>
        </form>

        <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
          {flags.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">Nenhuma feature flag cadastrada.</div>
          ) : (
            flags.map((f) => (
              <div key={f.id} className="p-3 flex items-center justify-between text-sm gap-3">
                <div>
                  <div className="font-medium text-slate-900">{f.code}</div>
                  <div className="text-xs text-slate-500">{f.description || "Sem descrição"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded border ${f.enabled ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-600 bg-slate-50"}`}>
                    {f.enabled ? "Ativa" : "Inativa"}
                  </span>
                  <button onClick={() => toggleFlag(f)} className="text-xs text-indigo-700 hover:underline">Alternar</button>
                  <button onClick={() => excluirFlag(f.id)} className="text-xs text-rose-700 hover:underline">Excluir</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-3">Integrações</div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/master/configuracoes/masteria"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            MasterIA
          </Link>
          <Link
            href="/master/configuracoes/aplicativos"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            Aplicativos
          </Link>
          <Link
            href="/master/configuracoes/site"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            Site (Landing)
          </Link>
          <Link
            href="/master/configuracoes/mercado-pago"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            Mercado Pago
          </Link>
          <Link
            href="/master/configuracoes/asaas"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            Asaas
          </Link>
          <Link
            href="/master/configuracoes/whatsapp"
            className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            WhatsApp
          </Link>
        </div>
      </section>
    </div>
  );
}
