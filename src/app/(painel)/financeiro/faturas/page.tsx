"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import { financeiroErrorMessage, getAccessTokenOrThrow } from "@/lib/financeiro";
import { logError, logInfo } from "@/lib/observability";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Fatura = {
  id: string;
  valor_centavos: number;
  status: string;
  vencimento: string | null;
  created_at: string;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
};

export default function FinanceiroFaturasPage() {
  const [loading, setLoading] = useState(true);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [selected, setSelected] = useState<Fatura | null>(null);
  const [metodo, setMetodo] = useState<"pix" | "cartao" | "boleto">("pix");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const [boletoBarcode, setBoletoBarcode] = useState<string | null>(null);

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardInstallments, setCardInstallments] = useState("1");
  const [payerDoc, setPayerDoc] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
        if (sessErr) throw sessErr;
        const session = sessionData.session;
        if (!session) {
          throw new Error("Sessão expirada. Faça login novamente.");
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (profileErr) throw profileErr;
        if (!profile?.empresa_id) {
          throw new Error("Empresa não identificada para o usuário logado.");
        }

        const { data, error } = await supabase
          .from("faturas")
          .select("id, valor_centavos, status, vencimento, created_at, pix_qr_code, pix_copia_cola")
          .eq("empresa_id", profile.empresa_id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;

        const lista = (data ?? []) as Fatura[];
        setFaturas(lista);
        setSelected(lista.find((f) => f.status === "aberta") ?? lista[0] ?? null);
      } catch (e) {
        logError("financeiro.faturas", "Falha ao carregar faturas", e);
        setErro(financeiroErrorMessage(e, "Falha ao carregar faturas."));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function gerarPix() {
    if (!selected) return;
    if (selected.status !== "aberta") {
      setErro("Somente faturas em aberto podem gerar pagamento.");
      return;
    }

    setBusy(true);
    setErro("");
    setOkMsg("");

    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-pix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fatura_id: selected.id }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Erro ao gerar PIX");
      }

      setSelected((prev) => prev ? ({ ...prev, pix_qr_code: json.pix_qr_code ?? prev.pix_qr_code, pix_copia_cola: json.pix_copia_cola ?? prev.pix_copia_cola }) : prev);
      logInfo("financeiro.faturas", "PIX gerado", { fatura_id: selected.id });
      setOkMsg("PIX gerado com sucesso.");
    } catch (e) {
      logError("financeiro.faturas", "Erro ao gerar PIX", e, { fatura_id: selected.id });
      setErro(financeiroErrorMessage(e, "Erro ao gerar PIX."));
    } finally {
      setBusy(false);
    }
  }

  async function pagarCartao() {
    if (!selected) return;
    if (selected.status !== "aberta") {
      setErro("Somente faturas em aberto podem ser pagas.");
      return;
    }
    if (!cardName || !cardNumber || !cardExpMonth || !cardExpYear || !cardCvv) {
      setErro("Preencha todos os dados do cartão.");
      return;
    }
    if (!payerDoc.trim()) {
      setErro("Informe CPF/CNPJ do pagador.");
      return;
    }

    setBusy(true);
    setErro("");
    setOkMsg("");
    setBoletoUrl(null);
    setBoletoBarcode(null);

    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fatura_id: selected.id,
          method: "cartao",
          card: {
            name: cardName,
            number: cardNumber,
            exp_month: cardExpMonth,
            exp_year: cardExpYear,
            cvv: cardCvv,
            installments: Number(cardInstallments || "1"),
          },
          payer: {
            doc_number: payerDoc,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Erro ao processar cartão");
      }

      logInfo("financeiro.faturas", "Pagamento em cartão solicitado", {
        fatura_id: selected.id,
        status: json.status ?? "em_processamento",
      });
      setOkMsg(`Pagamento enviado. Status: ${json.status ?? "em processamento"}`);
    } catch (e) {
      logError("financeiro.faturas", "Erro ao processar cartão", e, { fatura_id: selected.id });
      setErro(financeiroErrorMessage(e, "Erro ao processar pagamento em cartão."));
    } finally {
      setBusy(false);
    }
  }

  async function gerarBoleto() {
    if (!selected) return;
    if (selected.status !== "aberta") {
      setErro("Somente faturas em aberto podem gerar boleto.");
      return;
    }
    if (!payerDoc.trim()) {
      setErro("Informe CPF/CNPJ do pagador.");
      return;
    }

    setBusy(true);
    setErro("");
    setOkMsg("");

    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fatura_id: selected.id,
          method: "boleto",
          payer: {
            doc_number: payerDoc,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error ?? "Erro ao gerar boleto");
      }

      logInfo("financeiro.faturas", "Boleto gerado", { fatura_id: selected.id });
      setBoletoUrl(json.boleto_url ?? null);
      setBoletoBarcode(json.boleto_barcode ?? null);
      setOkMsg("Boleto gerado com sucesso.");
    } catch (e) {
      logError("financeiro.faturas", "Erro ao gerar boleto", e, { fatura_id: selected.id });
      setErro(financeiroErrorMessage(e, "Erro ao gerar boleto."));
    } finally {
      setBusy(false);
    }
  }

  const fmt = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Faturas e Pagamentos</h1>
        <p className="text-sm text-slate-500 mt-0.5">Selecione uma fatura e pague por PIX, cartão ou boleto sem sair do sistema.</p>
      </div>

      {erro && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {okMsg && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{okMsg}</div>}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">Últimas faturas</div>
            <div className="divide-y divide-slate-100">
              {faturas.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">Nenhuma fatura encontrada.</div>
              ) : faturas.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelected(f)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition ${selected?.id === f.id ? "bg-indigo-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{fmt(f.valor_centavos)}</div>
                      <div className="text-xs text-slate-500">{new Date(f.created_at).toLocaleDateString("pt-BR")}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600">{f.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-900">Pagamento</h2>
            {!selected ? (
              <p className="text-sm text-slate-500">Selecione uma fatura para continuar.</p>
            ) : (
              <>
                <div className="text-sm text-slate-600">Fatura: <span className="font-mono">{selected.id}</span></div>
                <div className="text-sm text-slate-600">Valor: <span className="font-semibold text-slate-900">{fmt(selected.valor_centavos)}</span></div>
                <div className="text-sm text-slate-600">Status: <span className="font-medium text-slate-900">{selected.status}</span></div>

                <div className="flex gap-2">
                  <button onClick={() => setMetodo("pix")} className={`px-3 py-1.5 rounded-md text-sm ${metodo === "pix" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>PIX</button>
                  <button onClick={() => setMetodo("cartao")} className={`px-3 py-1.5 rounded-md text-sm ${metodo === "cartao" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>Cartão</button>
                  <button onClick={() => setMetodo("boleto")} className={`px-3 py-1.5 rounded-md text-sm ${metodo === "boleto" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>Boleto</button>
                </div>

                {metodo === "pix" ? (
                  <div className="space-y-3">
                    {selected.pix_qr_code ? (
                      <>
                        <Image src={selected.pix_qr_code} alt="QR PIX" width={192} height={192} className="w-48 h-48 object-contain rounded-lg border border-slate-200" />
                        {selected.pix_copia_cola && (
                          <div className="text-xs bg-slate-50 border border-slate-200 rounded-md p-2 break-all font-mono">
                            {selected.pix_copia_cola}
                          </div>
                        )}
                      </>
                    ) : (
                      <button disabled={busy} onClick={gerarPix} className="px-4 py-2 rounded-md text-sm bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60">
                        {busy ? "Gerando..." : "Gerar PIX"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-2">
                      <input
                        className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                        placeholder="Documento (CPF/CNPJ)"
                        value={payerDoc}
                        onChange={(e) => setPayerDoc(e.target.value)}
                      />
                    </div>

                    {metodo === "cartao" ? (
                      <>
                        <div className="grid md:grid-cols-2 gap-2">
                          <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Nome no cartão" value={cardName} onChange={(e) => setCardName(e.target.value)} />
                          <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Número do cartão" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                          <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Mês (MM)" value={cardExpMonth} onChange={(e) => setCardExpMonth(e.target.value)} />
                          <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Ano (YYYY)" value={cardExpYear} onChange={(e) => setCardExpYear(e.target.value)} />
                          <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="CVV" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
                          <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Parcelas" value={cardInstallments} onChange={(e) => setCardInstallments(e.target.value)} />
                        </div>
                        <button disabled={busy} onClick={pagarCartao} className="px-4 py-2 rounded-md text-sm bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:opacity-60">
                          {busy ? "Processando..." : "Pagar com cartão"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button disabled={busy} onClick={gerarBoleto} className="px-4 py-2 rounded-md text-sm bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:opacity-60">
                          {busy ? "Gerando..." : "Gerar boleto"}
                        </button>
                        {boletoUrl && (
                          <a href={boletoUrl} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 hover:underline">
                            Abrir boleto em nova aba
                          </a>
                        )}
                        {boletoBarcode && (
                          <div className="text-xs bg-slate-50 border border-slate-200 rounded-md p-2 break-all font-mono">
                            {boletoBarcode}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
