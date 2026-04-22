"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { supabase } from "@/lib/supabase/client";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const [empresaNome, setEmpresaNome] = useState<string | null>(null);
  const [usuarioNome, setUsuarioNome] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [trialDiasRestantes, setTrialDiasRestantes] = useState<number | null>(null);
  const [mensalidadeBanner, setMensalidadeBanner] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, empresa_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      setUsuarioNome(profile?.nome ?? null);

      const { data: master } = await supabase.rpc("is_super_admin");
      setIsSuperAdmin(Boolean(master));

      const { data: billing } = await supabase.rpc("get_billing_current");
      const statusAssinatura = String(billing?.status ?? "").toLowerCase();
      const trialAte = billing?.trial_ate ? new Date(billing.trial_ate) : null;
      const proximaCobranca = billing?.proxima_cobranca ? new Date(billing.proxima_cobranca) : null;

      const { data: billingPolicy } = await supabase.rpc("get_billing_policy");
      const graceDays = Number(billingPolicy?.grace_days ?? 5);

      if (statusAssinatura === "trial" && trialAte && !Number.isNaN(trialAte.getTime())) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const vencimento = new Date(trialAte);
        vencimento.setHours(0, 0, 0, 0);

        const diffMs = vencimento.getTime() - hoje.getTime();
        const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        setTrialDiasRestantes(dias >= 0 && dias <= 7 ? dias : null);
      } else {
        setTrialDiasRestantes(null);
      }

      if (statusAssinatura === "bloqueada") {
        setMensalidadeBanner("Seu acesso está bloqueado, efetue o pagamento para continuar usando");
      } else if (proximaCobranca && !Number.isNaN(proximaCobranca.getTime())) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const vencimento = new Date(proximaCobranca);
        vencimento.setHours(0, 0, 0, 0);

        const diasParaVencimento = Math.ceil(
          (vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Pré-vencimento: mostrar somente quando faltar até 3 dias.
        if (diasParaVencimento >= 0 && diasParaVencimento <= 3) {
          setMensalidadeBanner(
            diasParaVencimento === 0
              ? "Sua mensalidade vence hoje."
              : `Sua mensalidade vence em ${diasParaVencimento} dia${diasParaVencimento === 1 ? "" : "s"}.`
          );
        } else if (statusAssinatura === "past_due" || diasParaVencimento < 0) {
          const diasAtraso = Math.abs(diasParaVencimento);
          const diasParaBloqueio = Math.max(0, graceDays - diasAtraso);

          setMensalidadeBanner(
            diasParaBloqueio === 0
              ? "Sua mensalidade venceu. Seu acesso será bloqueado hoje se o pagamento não for efetuado."
              : `Sua mensalidade venceu. Em ${diasParaBloqueio} dia${diasParaBloqueio === 1 ? "" : "s"}, seu acesso será bloqueado se não houver pagamento.`
          );
        } else {
          setMensalidadeBanner(null);
        }
      } else {
        setMensalidadeBanner(null);
      }

      if (profile?.empresa_id) {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("nome")
          .eq("id", profile.empresa_id)
          .maybeSingle();
        setEmpresaNome(empresa?.nome ?? null);
      }
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {trialDiasRestantes != null ? (
        <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium text-center">
          {trialDiasRestantes === 0
            ? "Seu teste grátis vence hoje."
            : `Seu teste grátis vence em ${trialDiasRestantes} dia${trialDiasRestantes === 1 ? "" : "s"}.`}
        </div>
      ) : null}

      {mensalidadeBanner ? (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-medium text-center">
          {mensalidadeBanner} {" "}
          <Link href="/configuracoes/meu-plano" className="underline font-semibold hover:text-red-100">
            Clique aqui para efetuar o pagamento.
          </Link>
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          empresaNome={empresaNome}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            empresaNome={empresaNome}
            usuarioNome={usuarioNome}
            isSuperAdmin={isSuperAdmin}
            onMenuToggle={() => setMobileMenuOpen((v) => !v)}
          />
          <main className="flex-1 p-3 sm:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
