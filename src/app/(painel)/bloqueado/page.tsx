"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Fatura = {
  id: string;
  valor_centavos: number;
  status: string;
  vencimento: string | null;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
};

export default function BloqueadoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const motivo = searchParams.get("motivo");
  const [fatura, setFatura] = useState<Fatura | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [assinaturaStatus, setAssinaturaStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerandoPix, setGerandoPix] = useState(false);
  const [gerandoCheckout, setGerandoCheckout] = useState(false);
  const [metodo, setMetodo] = useState<"pix" | "cartao" | "boleto">("pix");
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const { data: profile } = await supabase.from("profiles")
        .select("empresa_id").eq("user_id", session.user.id).maybeSingle();
      if (!profile?.empresa_id) { setLoading(false); return; }

      setEmpresaId(profile.empresa_id);

      let statusAtual: string | null = null;
      let faturaAtual: Fatura | null = null;
      const { data: billing } = await supabase.rpc("get_billing_current");
      if (billing) {
        statusAtual = billing.status ?? null;
        if (billing.fatura_id) {
          faturaAtual = {
            id: billing.fatura_id,
            valor_centavos: billing.valor_centavos ?? 0,
            status: billing.fatura_status ?? "aberta",
            vencimento: billing.vencimento ?? null,
            pix_qr_code: billing.pix_qr_code ?? null,
            pix_copia_cola: billing.pix_copia_cola ?? null,
          };
        }
      } else {
        const { data: assin } = await supabase.from("assinaturas")
          .select("status").eq("empresa_id", profile.empresa_id).maybeSingle();
        statusAtual = assin?.status ?? null;
      }

      setAssinaturaStatus(statusAtual);

      if (statusAtual === "ativa" || statusAtual === "trial") {
        router.replace("/dashboard");
        return;
      }

      if (!faturaAtual) {
        const { data: fat } = await supabase.from("faturas")
          .select("id, valor_centavos, status, vencimento, pix_qr_code, pix_copia_cola")
          .eq("empresa_id", profile.empresa_id)
          .eq("status", "aberta")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        faturaAtual = fat as Fatura | null;
      }

      setFatura(faturaAtual);
      setLoading(false);
    }
    load();
  }, [router]);

  async function gerarPix() {
    if (!fatura) return;
    setGerandoPix(true);
    setErro("");

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-pix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ANON_KEY}`,
      },
      body: JSON.stringify({ fatura_id: fatura.id }),
    });

    const json = await res.json();
    setGerandoPix(false);

    if (!res.ok || json.error) {
      setErro(json.error ?? "Erro ao gerar PIX.");
      return;
    }

    setFatura((prev) => prev ? {
      ...prev,
      pix_qr_code: json.pix_qr_code ?? prev.pix_qr_code,
      pix_copia_cola: json.pix_copia_cola ?? prev.pix_copia_cola,
    } : prev);
  }

  async function verificarPagamento() {
    setVerificando(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setVerificando(false); return; }

    const { data: assin } = await supabase.from("assinaturas")
      .select("status").eq("empresa_id", empresaId).maybeSingle();

    if (assin?.status === "ativa") {
      router.replace("/dashboard");
      return;
    }
    setVerificando(false);
    alert("Pagamento ainda não confirmado. Aguarde alguns instantes.");
  }

  async function gerarCheckout() {
    if (!fatura) return;
    setGerandoCheckout(true);
    setErro("");

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ANON_KEY}`,
      },
      body: JSON.stringify({ fatura_id: fatura.id, method: "checkout" }),
    });

    const json = await res.json();
    setGerandoCheckout(false);

    if (!res.ok || json.error) {
      setErro(json.error ?? "Erro ao criar checkout.");
      return;
    }

    if (json.init_point) {
      // redirect to Mercado Pago checkout (hosted)
      window.location.href = json.init_point;
    } else {
      setErro("Resposta inválida do MP.");
    }
  }

  async function copiarPix() {
    if (!fatura?.pix_copia_cola) return;
    await navigator.clipboard.writeText(fatura.pix_copia_cola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  }

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const fmt = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const temPix = fatura?.pix_qr_code || fatura?.pix_copia_cola;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div>
          <div className="text-4xl mb-3">🔒</div>
          <h1 className="text-2xl font-bold text-white">Acesso bloqueado</h1>
          {motivo === "modulo" ? (
            <p className="text-slate-400 mt-2 text-sm">
              Este módulo não está disponível no seu plano atual.
              Escolha um plano com este recurso para continuar.
            </p>
          ) : (
            <p className="text-slate-400 mt-2 text-sm">
              {assinaturaStatus === "past_due"
                ? "Sua assinatura está com pagamento em atraso."
                : "Sua assinatura está bloqueada."}
              {" "}Regularize para retomar o acesso.
            </p>
          )}
        </div>

        {erro && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {erro}
          </div>
        )}

        {loading ? (
          <div className="text-slate-500 text-sm">Carregando...</div>
        ) : fatura ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Valor da fatura</span>
              <span className="text-xl font-bold text-white">{fmt(fatura.valor_centavos)}</span>
            </div>

            {fatura.vencimento && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Vencimento</span>
                <span className="text-white">{new Date(fatura.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setMetodo("pix")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold ${metodo === "pix" ? "bg-slate-700 text-white" : "bg-slate-950 text-slate-400 border border-slate-800"}`}>
                  PIX
                </button>
                <button onClick={() => setMetodo("cartao")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold ${metodo === "cartao" ? "bg-slate-700 text-white" : "bg-slate-950 text-slate-400 border border-slate-800"}`}>
                  Cartão
                </button>
                <button onClick={() => setMetodo("boleto")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold ${metodo === "boleto" ? "bg-slate-700 text-white" : "bg-slate-950 text-slate-400 border border-slate-800"}`}>
                  Boleto
                </button>
              </div>

              {metodo === "pix" && !temPix && (
                <button onClick={gerarPix} disabled={gerandoPix}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-60">
                  {gerandoPix ? "Gerando PIX..." : "Gerar PIX para pagamento"}
                </button>
              )}

              {metodo === "pix" && temPix && (
                <>
                  {fatura.pix_qr_code && (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-slate-400">Escaneie o QR Code</p>
                      <Image src={fatura.pix_qr_code} alt="QR Code PIX" width={192} height={192} className="bg-white p-2 rounded-xl" />
                    </div>
                  )}

                  {fatura.pix_copia_cola && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">PIX Copia e Cola</p>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 break-all font-mono select-all">
                        {fatura.pix_copia_cola.slice(0, 80)}...
                      </div>
                      <button onClick={copiarPix}
                        className="mt-2 w-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 py-2 rounded-lg text-sm transition">
                        {copiado ? "✓ Copiado!" : "Copiar código PIX"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {metodo !== "pix" && (
                <div>
                  <p className="text-sm text-slate-400">Você será redirecionado para o checkout seguro do Mercado Pago.</p>
                  <button onClick={gerarCheckout} disabled={gerandoCheckout}
                    className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-xl text-sm transition disabled:opacity-60">
                    {gerandoCheckout ? "Abrindo checkout..." : metodo === "cartao" ? "Pagar com Cartão" : "Pagar com Boleto"}
                  </button>
                </div>
              )}
            </div>

            <button onClick={verificarPagamento} disabled={verificando}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-60">
              {verificando ? "Verificando..." : "Já paguei — Verificar pagamento"}
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-sm text-slate-400 space-y-3">
            <p>Nenhuma fatura em aberto encontrada.</p>
            <p className="text-xs">Entre em contato com o suporte para regularizar sua assinatura.</p>
          </div>
        )}

        <button onClick={sair} className="text-sm text-slate-500 hover:text-slate-300 transition">
          Sair do sistema
        </button>
      </div>
    </div>
  );
}
