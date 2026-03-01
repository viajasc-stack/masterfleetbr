"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const ROTAS_PUBLICAS = ["/", "/login", "/cadastro"];
const ROTAS_MASTER = ["/master"];
const ROTA_BLOQUEADO = "/bloqueado";

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

      const isMaster = ROTAS_MASTER.some((r) => pathname === r || pathname?.startsWith(r + "/"));
      const isBloqueado = pathname === ROTA_BLOQUEADO || pathname?.startsWith(ROTA_BLOQUEADO + "/");

      if (!isMaster && !isBloqueado) {
        let block = false;
        const { data: billing } = await supabase.rpc("get_billing_current");
        if (billing && (billing.status === "bloqueada" || billing.status === "past_due")) {
          block = true;
        } else {
          const { data: profile } = await supabase.from("profiles")
            .select("empresa_id").eq("user_id", data.session.user.id).maybeSingle();

          if (profile?.empresa_id) {
            const { data: assin } = await supabase.from("assinaturas")
              .select("status").eq("empresa_id", profile.empresa_id).maybeSingle();

            const status = assin?.status ?? "trial";
            if (status === "bloqueada" || status === "past_due") {
              block = true;
            }
          }
        }
        if (block) {
          router.replace(ROTA_BLOQUEADO);
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
