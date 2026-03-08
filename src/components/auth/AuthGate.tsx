"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getRequiredModuleForPath, loadEmpresaModuleAccess } from "@/lib/moduleAccess";

const ROTAS_PUBLICAS = ["/", "/login", "/cadastro", "/orcamento"];
const ROTAS_MASTER = ["/master"];
const ROTA_BLOQUEADO = "/bloqueado";
const ROTA_PRIMEIRO_ACESSO = "/primeiro-acesso";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const isPublica = ROTAS_PUBLICAS.some((r) =>
        r === "/" ? pathname === "/" : pathname === r || pathname?.startsWith(r + "/")
      );
      if (isPublica) { setOk(true); return; }

      const { data } = await supabase.auth.getSession();
      if (!data.session) { router.replace("/login"); return; }

      const isPrimeiroAcesso = pathname === ROTA_PRIMEIRO_ACESSO || pathname?.startsWith(ROTA_PRIMEIRO_ACESSO + "/");
      const mustChangePassword = !!data.session.user.user_metadata?.must_change_password;
      if (mustChangePassword && !isPrimeiroAcesso) {
        router.replace(ROTA_PRIMEIRO_ACESSO);
        return;
      }
      if (!mustChangePassword && isPrimeiroAcesso) {
        router.replace("/dashboard");
        return;
      }

      const isMaster = ROTAS_MASTER.some((r) => pathname === r || pathname?.startsWith(r + "/"));
      const isBloqueado = pathname === ROTA_BLOQUEADO || pathname?.startsWith(ROTA_BLOQUEADO + "/");

      if (!isMaster && !isBloqueado) {
        let block = false;
        const moduleAccess = await loadEmpresaModuleAccess();
        const { data: billing } = await supabase.rpc("get_billing_current");
        if (billing && (billing.status === "bloqueada" || billing.status === "past_due")) {
          block = true;
        } else {
          if (moduleAccess.empresaId) {
            const status = moduleAccess.assinaturaStatus ?? "trial";
            if (status === "bloqueada" || status === "past_due") {
              block = true;
            }
          }
        }
        if (block) {
          router.replace(ROTA_BLOQUEADO);
          return;
        }

        const requiredModule = getRequiredModuleForPath(pathname);
        if (
          requiredModule &&
          !moduleAccess.canUseAllModules &&
          !moduleAccess.allowedModules.includes(requiredModule)
        ) {
          router.replace(`${ROTA_BLOQUEADO}?motivo=modulo`);
          return;
        }
      }

      if (mounted) setOk(true);
    }

    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => { check(); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [router, pathname]);

  if (!ok) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Carregando…
      </div>
    );
  }

  return <>{children}</>;
}
