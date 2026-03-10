"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ReferralDashboard = {
  referral_code: string;
  can_invite: boolean;
  total_signed_up: number;
  total_activated: number;
  referred_companies: Array<{
    referral_id: string;
    empresa_id: string;
    empresa_nome: string;
    status: "signed_up" | "activated" | "cancelled";
    signed_up_at: string;
    activated_at: string | null;
    plano_nome: string | null;
    assinatura_status: string | null;
  }>;
};

export default function ConvideEGanhePage() {
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralDashboard | null>(null);
  const [msg, setMsg] = useState("");
  const [debugCtx, setDebugCtx] = useState<{ userId: string | null; profileEmpresaId: string | null; usuarioEmpresaId: string | null }>({
    userId: null,
    profileEmpresaId: null,
    usuarioEmpresaId: null,
  });

  async function loadDashboard() {
    setLoading(true);
    setMsg("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    if (userId) {
      const [{ data: profile }, { data: usuario }] = await Promise.all([
        supabase.from("profiles").select("empresa_id").eq("user_id", userId).maybeSingle(),
        supabase.from("usuarios").select("empresa_id").eq("auth_user_id", userId).maybeSingle(),
      ]);
      setDebugCtx({
        userId,
        profileEmpresaId: (profile?.empresa_id as string | null) ?? null,
        usuarioEmpresaId: (usuario?.empresa_id as string | null) ?? null,
      });
    }

    const { data: billing } = await supabase.rpc("get_billing_current");
    setBillingStatus(billing?.status ?? null);

    const { data, error } = await supabase.rpc("get_my_referral_dashboard");
    if (error) {
      setReferral(null);
      if (error.message?.toLowerCase().includes("does not exist")) {
        setMsg("Recurso ainda não disponível no banco. Aplique a migration do Convide e Ganhe.");
      } else if (error.message?.toLowerCase().includes("empresa_not_found")) {
        setMsg("Seu usuário não está vinculado a uma empresa (profiles/usuarios). Refaça login ou vincule o usuário no painel master.");
      } else {
        setMsg(`Erro ao carregar dados: ${error.message}`);
      }
      setLoading(false);
      return;
    }

    setReferral((data ?? null) as ReferralDashboard | null);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function ativarConvideEGanhe() {
    setActivating(true);
    setMsg("");

    const { error } = await supabase.rpc("activate_my_referral_program");
    if (error) {
      if (error.message?.toLowerCase().includes("assinatura_not_active")) {
        setMsg("Sua assinatura precisa estar ativa para habilitar o Convide e Ganhe.");
      } else if (error.message?.toLowerCase().includes("empresa_not_found")) {
        setMsg("Seu usuário não está vinculado a uma empresa. Faça login novamente e confirme o vínculo da conta com a empresa.");
      } else if (error.message?.toLowerCase().includes("does not exist")) {
        setMsg("Função de ativação ainda não disponível. Aplique a migration mais recente do Convide e Ganhe.");
      } else {
        setMsg(`Não foi possível ativar agora: ${error.message}`);
      }
      setActivating(false);
      return;
    }

    await loadDashboard();
    setMsg("Convide e Ganhe ativado com sucesso! Seu código de convite já está disponível.");
    setActivating(false);
  }

  if (loading) {
    return <div className="text-slate-500 text-sm">Carregando Convide e Ganhe...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Convide e Ganhe</h1>
        <p className="text-slate-600 text-sm mt-0.5">Convide empresas, acompanhe ativações e gere descontos automáticos.</p>
      </div>

      {msg ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">{msg}</div>
      ) : null}

      {msg && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Diagnóstico rápido — user: <strong>{debugCtx.userId ?? "—"}</strong> · profiles.empresa_id: <strong>{debugCtx.profileEmpresaId ?? "—"}</strong> · usuarios.empresa_id: <strong>{debugCtx.usuarioEmpresaId ?? "—"}</strong>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-2">
        <div className="font-medium text-slate-900">Como funciona</div>
        <ol className="list-decimal ml-5 text-slate-700 space-y-1">
          <li>Ative o recurso para gerar seu código único de convite.</li>
          <li>Compartilhe seu link com novas empresas.</li>
          <li>Quando uma empresa entrar pelo seu link e ativar assinatura, os créditos são gerados automaticamente.</li>
          <li>Os descontos são aplicados nas próximas faturas conforme a campanha configurada no painel master.</li>
        </ol>
        <div className="pt-2">
          <button
            type="button"
            onClick={ativarConvideEGanhe}
            disabled={activating || billingStatus !== "ativa"}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-60"
          >
            {activating ? "Ativando..." : "Ativar Convide e Ganhe"}
          </button>
        </div>
      </div>

      {billingStatus !== "ativa" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
          Sua assinatura precisa estar ativa para usar Convide e Ganhe.
        </div>
      ) : null}

      {!referral ? null : (
        <>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-slate-500 text-xs">Código de convite</div>
              <div className="text-slate-900 font-mono font-semibold mt-1">{referral.referral_code}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-slate-500 text-xs">Cadastradas pelo link</div>
              <div className="text-slate-900 font-semibold mt-1">{referral.total_signed_up}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-slate-500 text-xs">Ativadas</div>
              <div className="text-slate-900 font-semibold mt-1">{referral.total_activated}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <div className="text-slate-500 text-xs mb-1">Seu link de convite</div>
            <div className="text-slate-800 break-all font-mono">
              {typeof window !== "undefined" ? `${window.location.origin}/cadastro?ref=${referral.referral_code}` : `/cadastro?ref=${referral.referral_code}`}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-900">Empresas indicadas</div>
            <div className="divide-y divide-slate-200">
              {referral.referred_companies.length === 0 ? (
                <div className="p-4 text-slate-500 text-sm">Nenhuma empresa cadastrada pelo seu link ainda.</div>
              ) : (
                referral.referred_companies.map((r) => (
                  <div key={r.referral_id} className="p-4">
                    <div className="font-medium text-slate-900">{r.empresa_nome}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Status: {r.status} • Assinatura: {r.assinatura_status ?? "—"} • Plano: {r.plano_nome ?? "—"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Cadastro: {new Date(r.signed_up_at).toLocaleString("pt-BR")}
                      {r.activated_at ? ` • Ativada: ${new Date(r.activated_at).toLocaleString("pt-BR")}` : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
