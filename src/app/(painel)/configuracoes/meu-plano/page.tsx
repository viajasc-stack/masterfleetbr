"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import { financeiroErrorMessage, getAccessTokenOrThrow } from "@/lib/financeiro";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Billing = {
  status: string;
  billing_model?: string | null;
  valor_total_centavos?: number | null;
  modulos_ativos?: string[];
  proxima_cobranca?: string | null;
};

type Modulo = {
  codigo: string;
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  imagem_url?: string | null;
  preco_centavos: number;
  ativo_empresa: boolean;
  ativo_global: boolean;
  venda_ativa: boolean;
  base_obrigatoria: boolean;
};

type Profile = {
  role: string | null;
};

type PaymentMethod = "pix" | "cartao";

type FaturaPagamento = {
  id: string;
  status: string;
  valor_bruto_centavos?: number | null;
  desconto_centavos?: number | null;
  valor_centavos: number;
  vencimento: string | null;
  created_at: string;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
};

const HIDDEN_MODULE_CODES = new Set(["api_integracoes", "automacoes"]);
const LEGACY_OPERATIONAL_CODES = new Set(["configuracoes", "usuarios", "suporte", "relatorios"]);

export default function MeuPlanoPage() {
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [valorPagamentoCentavos, setValorPagamentoCentavos] = useState(0);
  const [savingModulo, setSavingModulo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentErro, setPaymentErro] = useState<string | null>(null);
  const [paymentMsg, setPaymentMsg] = useState<string | null>(null);
  const [faturaAberta, setFaturaAberta] = useState<FaturaPagamento | null>(null);
  const [pixQrCode, setPixQrCode] = useState<string | null>(null);
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null);
  const [pixSecondsLeft, setPixSecondsLeft] = useState(0);
  const [pixExpirado, setPixExpirado] = useState(false);
  const [pixAguardandoPagamento, setPixAguardandoPagamento] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardInstallments, setCardInstallments] = useState("1");
  const [payerDoc, setPayerDoc] = useState("");
  const [cardVerificando, setCardVerificando] = useState(false);
  const [cardVerificationAttempts, setCardVerificationAttempts] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const modulosAtivos = useMemo(() => modulos.filter((m) => m.ativo_empresa), [modulos]);
  const modulosInativos = useMemo(() => modulos.filter((m) => !m.ativo_empresa), [modulos]);

  let diasParaVencimento: number | null = null;
  if (billing?.proxima_cobranca) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencimento = new Date(billing.proxima_cobranca);
    if (!Number.isNaN(vencimento.getTime())) {
      vencimento.setHours(0, 0, 0, 0);
      diasParaVencimento = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const podeEfetuarPagamento = isAdmin && diasParaVencimento != null && diasParaVencimento <= 3;

  function iniciaisModulo(nome: string) {
    return nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }

  function nomeApresentacaoModulo(modulo: Modulo) {
    return modulo.nome;
  }

  function categoriaApresentacaoModulo(modulo: Modulo) {
    return modulo.categoria || "geral";
  }

  function moeda(v?: number | null) {
    return ((v ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function cupomErrorMessage(error: unknown) {
    const msg = financeiroErrorMessage(error, "Não foi possível aplicar o cupom.");
    if (/coupon_not_found/i.test(msg)) return "Cupom não encontrado.";
    if (/coupon_inactive/i.test(msg)) return "Este cupom está inativo.";
    if (/coupon_not_started/i.test(msg)) return "Este cupom ainda não iniciou a vigência.";
    if (/coupon_expired/i.test(msg)) return "Este cupom expirou.";
    if (/coupon_first_invoice_only/i.test(msg)) return "Este cupom é válido apenas para a primeira fatura.";
    if (/coupon_min_invoice_amount_not_met/i.test(msg)) return "Valor da fatura não atende ao mínimo exigido pelo cupom.";
    if (/coupon_not_stackable_invoice_has_discount/i.test(msg)) return "Este cupom não permite combinação com outro desconto já aplicado.";
    if (/coupon_max_redemptions_per_empresa_reached/i.test(msg)) return "Limite de uso deste cupom por empresa já foi atingido.";
    if (/coupon_max_redemptions_reached/i.test(msg)) return "Limite total de usos deste cupom foi atingido.";
    if (/coupon_generated_zero_discount/i.test(msg)) return "Este cupom não gerou desconto para esta fatura.";
    return msg;
  }

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);

    const [
      { data: billingData, error: billingErr },
      { data: catalogoData, error: catalogoErr },
      { data: imagensData },
    ] = await Promise.all([
      supabase.rpc("get_billing_current"),
      supabase.rpc("get_my_module_catalog"),
      supabase.from("modulos_globais").select("codigo, metadata"),
    ]);

    const { data: authData } = await supabase.auth.getSession();
    const userId = authData.session?.user?.id ?? null;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const role = (profileData as Profile | null)?.role ?? null;
      setIsAdmin(role === "admin" || role === "dono");
    } else {
      setIsAdmin(false);
    }

    if (billingErr || catalogoErr) {
      setErro(billingErr?.message || catalogoErr?.message || "Falha ao carregar plano.");
      setLoading(false);
      return;
    }

    setBilling({
      status: billingData?.status ?? "trial",
      billing_model: billingData?.billing_model ?? "modular",
      valor_total_centavos: billingData?.valor_total_centavos ?? null,
      modulos_ativos: Array.isArray(billingData?.modulos_ativos)
        ? billingData.modulos_ativos.map((m: unknown) => String(m))
        : [],
      proxima_cobranca: billingData?.proxima_cobranca ?? null,
    });
    const imagensPorCodigo = new Map<string, string | null>();
    (imagensData ?? []).forEach((row: { codigo?: string; metadata?: unknown }) => {
      const codigo = String(row?.codigo ?? "");
      const metadata = (row?.metadata ?? null) as { imagem_url?: string | null } | null;
      if (codigo) imagensPorCodigo.set(codigo, metadata?.imagem_url ?? null);
    });

    const catalogoBruto = (catalogoData as Modulo[]) ?? [];

    const catalogo = catalogoBruto.map((m) => ({
      ...m,
      imagem_url: imagensPorCodigo.get(m.codigo) ?? null,
    })).filter(
      (m) => !HIDDEN_MODULE_CODES.has(m.codigo) && !LEGACY_OPERATIONAL_CODES.has(m.codigo),
    );

    const valorCatalogoVisivel = catalogo
      .filter((m) => m.ativo_empresa)
      .reduce((total, m) => total + Number(m.preco_centavos || 0), 0);

    const valorBillingAtual = Number(billingData?.valor_total_centavos ?? 0);
    setValorPagamentoCentavos(
      valorCatalogoVisivel > 0 ? valorCatalogoVisivel : valorBillingAtual,
    );

    setModulos(catalogo);
    setLoading(false);
  }, []);

  const verificarStatusPagamento = useCallback(async (silencioso = false) => {
    if (!faturaAberta?.id) return false;

    const { data, error } = await supabase
      .from("faturas")
      .select("status")
      .eq("id", faturaAberta.id)
      .maybeSingle();

    if (error) {
      if (!silencioso) setPaymentErro(financeiroErrorMessage(error, "Não foi possível verificar o pagamento."));
      return false;
    }

    const statusAtual = String(data?.status ?? "").toLowerCase();
    if (statusAtual === "paga") {
      setPaymentMsg("Pagamento aprovado com sucesso. Plano atualizado.");
      setPaymentErro(null);
      setPixAguardandoPagamento(false);
      setCardVerificando(false);
      await carregar();
      return true;
    }

    if (!silencioso) {
      setPaymentMsg(`Pagamento ainda não aprovado. Status atual: ${statusAtual || "pendente"}.`);
    }

    return false;
  }, [faturaAberta?.id, carregar]);

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);

    return () => clearTimeout(t);
  }, [carregar]);

  useEffect(() => {
    if (!paymentModalOpen || !pixAguardandoPagamento) return;
    if (pixSecondsLeft <= 0) {
      setPixExpirado(true);
      setPixAguardandoPagamento(false);
      return;
    }

    const timeout = setTimeout(() => {
      setPixSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [paymentModalOpen, pixAguardandoPagamento, pixSecondsLeft]);

  useEffect(() => {
    if (!pixAguardandoPagamento || pixSecondsLeft <= 0 || !faturaAberta?.id) return;

    const interval = setInterval(() => {
      void verificarStatusPagamento(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [pixAguardandoPagamento, pixSecondsLeft, faturaAberta?.id, verificarStatusPagamento]);

  useEffect(() => {
    if (!cardVerificando || !faturaAberta?.id) return;
    if (cardVerificationAttempts >= 15) {
      setCardVerificando(false);
      return;
    }

    const timeout = setTimeout(() => {
      setCardVerificationAttempts((prev) => prev + 1);
      void verificarStatusPagamento(true);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [cardVerificando, cardVerificationAttempts, faturaAberta?.id, verificarStatusPagamento]);

  async function toggleModulo(modulo: Modulo) {
    setSavingModulo(modulo.codigo);
    setErro(null);
    setMsg(null);

    const { data, error } = await supabase.rpc("toggle_my_module_subscription", {
      p_modulo_codigo: modulo.codigo,
      p_ativo: !modulo.ativo_empresa,
    });

    if (error || !data) {
      setErro(error?.message ?? "Não foi possível alterar o módulo.");
      setSavingModulo(null);
      return;
    }

    setMsg(`Módulo ${modulo.nome} ${modulo.ativo_empresa ? "removido" : "adicionado"} com sucesso.`);
    await carregar();
    setSavingModulo(null);
  }

  async function carregarFaturaAberta() {
    const { data: authData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw sessErr;
    const session = authData.session;
    if (!session) throw new Error("Sessão expirada. Faça login novamente.");

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile?.empresa_id) throw new Error("Empresa não identificada para o usuário logado.");

    const { data, error } = await supabase
      .from("faturas")
      .select("id, valor_bruto_centavos, desconto_centavos, valor_centavos, status, vencimento, created_at, pix_qr_code, pix_copia_cola")
      .eq("empresa_id", profile.empresa_id)
      .eq("status", "aberta")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const fatura = (data as FaturaPagamento | null) ?? null;
    setFaturaAberta(fatura);
    return fatura;
  }

  function resetarPagamento() {
    setPaymentErro(null);
    setPaymentMsg(null);
    setPaymentBusy(false);
    setPixQrCode(null);
    setPixCopiaCola(null);
    setPixSecondsLeft(0);
    setPixExpirado(false);
    setPixAguardandoPagamento(false);
    setCardVerificando(false);
    setCardVerificationAttempts(0);
    setCouponCode("");
    setCouponBusy(false);
    setCouponMsg(null);
  }

  async function aplicarCupomDesconto() {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setPaymentErro("Informe um cupom para aplicar.");
      return;
    }

    setCouponBusy(true);
    setCouponMsg(null);
    setPaymentErro(null);
    setPaymentMsg(null);

    try {
      const fatura = faturaAberta ?? await carregarFaturaAberta();
      if (!fatura?.id) throw new Error("Nenhuma fatura em aberto foi encontrada.");

      const { data, error } = await supabase.rpc("apply_my_billing_coupon_code", {
        p_code: code,
        p_fatura_id: fatura.id,
      });

      if (error) throw error;

      const descontoCentavos = Number((data as { discount_centavos?: number } | null)?.discount_centavos ?? 0);
      await carregarFaturaAberta();
      setCouponCode(code);
      setCouponMsg(descontoCentavos > 0
        ? `Cupom aplicado com sucesso. Desconto de ${moeda(descontoCentavos)}.`
        : "Cupom aplicado com sucesso.");
    } catch (e) {
      setPaymentErro(cupomErrorMessage(e));
    } finally {
      setCouponBusy(false);
    }
  }

  async function desaplicarCupomAutoDaFatura(fatura?: FaturaPagamento | null) {
    const alvo = fatura ?? faturaAberta;
    if (!alvo?.id) return null;
    if (Number(alvo.desconto_centavos ?? 0) <= 0) return alvo;

    await supabase.rpc("unapply_my_billing_coupon_code", {
      p_fatura_id: alvo.id,
    });

    return await carregarFaturaAberta();
  }

  async function abrirModalPagamento() {
    setPaymentModalOpen(true);
    setPaymentMethod(null);
    resetarPagamento();
    try {
      const fatura = await carregarFaturaAberta();
      await desaplicarCupomAutoDaFatura(fatura);
      if (!fatura) {
        setPaymentErro("Nenhuma fatura em aberto foi encontrada para pagamento.");
      }
    } catch (e) {
      setPaymentErro(financeiroErrorMessage(e, "Falha ao carregar fatura em aberto."));
    }
  }

  async function fecharModalPagamento() {
    try {
      await desaplicarCupomAutoDaFatura();
      await carregar();
    } catch {
      // Não bloqueia o fechamento do modal em caso de falha ao remover cupom.
    } finally {
      setPaymentModalOpen(false);
      setPaymentMethod(null);
      resetarPagamento();
    }
  }

  async function gerarPixPagamento() {
    setPaymentBusy(true);
    setPaymentErro(null);
    setPaymentMsg(null);

    try {
      const fatura = faturaAberta ?? await carregarFaturaAberta();
      if (!fatura?.id) throw new Error("Nenhuma fatura em aberto foi encontrada.");

      const token = await getAccessTokenOrThrow();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-pix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fatura_id: fatura.id,
          expected_valor_centavos: totalModal,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Erro ao gerar PIX");

      setPixQrCode(json.pix_qr_code ?? null);
      setPixCopiaCola(json.pix_copia_cola ?? null);
      setPixSecondsLeft(300);
      setPixExpirado(false);
      setPixAguardandoPagamento(true);
      setPaymentMsg("PIX gerado com sucesso. Aguardando confirmação do pagamento.");
    } catch (e) {
      setPaymentErro(financeiroErrorMessage(e, "Erro ao gerar PIX."));
    } finally {
      setPaymentBusy(false);
    }
  }

  async function pagarComCartao() {
    if (!cardName || !cardNumber || !cardExpMonth || !cardExpYear || !cardCvv) {
      setPaymentErro("Preencha todos os dados do cartão.");
      return;
    }
    if (!payerDoc.trim()) {
      setPaymentErro("Informe CPF/CNPJ do pagador.");
      return;
    }

    setPaymentBusy(true);
    setPaymentErro(null);
    setPaymentMsg(null);

    try {
      const fatura = faturaAberta ?? await carregarFaturaAberta();
      if (!fatura?.id) throw new Error("Nenhuma fatura em aberto foi encontrada.");

      const token = await getAccessTokenOrThrow();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mp-create-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fatura_id: fatura.id,
          method: "cartao",
          expected_valor_centavos: totalModal,
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
      if (!res.ok || json.error) throw new Error(json.error ?? "Erro ao processar pagamento em cartão");

      if (String(json.status ?? "").toLowerCase() === "approved") {
        setPaymentMsg("Pagamento aprovado com sucesso.");
        setCardVerificando(false);
        await carregar();
      } else {
        setPaymentMsg(`Pagamento enviado. Status: ${json.status ?? "em processamento"}.`);
        setCardVerificando(true);
        setCardVerificationAttempts(0);
      }
    } catch (e) {
      setPaymentErro(financeiroErrorMessage(e, "Erro ao processar pagamento em cartão."));
    } finally {
      setPaymentBusy(false);
    }
  }

  function tempoPixFormatado() {
    const minutos = Math.floor(pixSecondsLeft / 60);
    const segundos = pixSecondsLeft % 60;
    return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
  }

  function selecionarMetodo(metodo: PaymentMethod) {
    setPaymentMethod(metodo);
    if (metodo === "pix" && !pixQrCode && !pixExpirado && !paymentBusy) {
      void gerarPixPagamento();
    }
  }

  const valorBrutoModal = valorPagamentoCentavos > 0
    ? valorPagamentoCentavos
    : Number(faturaAberta?.valor_bruto_centavos ?? faturaAberta?.valor_centavos ?? 0);
  const descontoBrutoFatura = Number(faturaAberta?.desconto_centavos ?? 0);
  const descontoModal = Math.min(Math.max(descontoBrutoFatura, 0), Math.max(valorBrutoModal, 0));
  const totalModal = Math.max(valorBrutoModal - descontoModal, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Meu plano</h1>
          <p className="text-sm text-slate-600 mt-1">
            Aqui você vê os módulos ativos da sua empresa e pode adicionar/remover módulos extras.
          </p>
        </div>
      </div>

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}
      {msg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando plano...</div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-6">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-500">Status</div>
              <div className="text-slate-900 font-medium mt-1 capitalize">{billing?.status ?? "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">Modelo</div>
              <div className="text-slate-900 font-medium mt-1 capitalize">{billing?.billing_model ?? "modular"}</div>
            </div>
            <div>
              <div className="text-slate-500">Valor mensal</div>
              <div className="text-slate-900 font-medium mt-1">{moeda(valorPagamentoCentavos)}</div>
              {podeEfetuarPagamento ? (
                <button
                  type="button"
                  onClick={() => void abrirModalPagamento()}
                  className="inline-flex mt-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
                >
                  Efetuar pagamento ({moeda(valorPagamentoCentavos)})
                </button>
              ) : null}
            </div>
            <div className="md:col-span-3">
              <div className="text-slate-500">Próxima cobrança</div>
              <div className="text-slate-900 font-medium mt-1">
                {billing?.proxima_cobranca ? new Date(billing.proxima_cobranca).toLocaleDateString("pt-BR") : "—"}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h2 className="text-lg font-semibold text-slate-900">Módulos ativos no momento</h2>
            <p className="text-sm text-slate-500 mt-1">Deslize horizontalmente para visualizar todos os módulos ativos.</p>

            {modulosAtivos.length === 0 ? (
              <p className="text-sm text-slate-500 mt-3">Nenhum módulo ativo.</p>
            ) : (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {modulosAtivos.map((m) => (
                  <div key={m.codigo} className="min-w-[240px] max-w-[240px] rounded-xl border border-slate-200 bg-slate-50/50 p-3 shrink-0">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-600">
                        {m.imagem_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.imagem_url} alt={nomeApresentacaoModulo(m)} className="h-full w-full object-cover" />
                        ) : (
                          <span>{iniciaisModulo(nomeApresentacaoModulo(m))}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{nomeApresentacaoModulo(m)}</div>
                        <div className="text-xs text-slate-500 mt-1">{m.descricao || m.codigo}</div>
                        <div className="text-xs text-slate-500 mt-1">{categoriaApresentacaoModulo(m)} • {moeda(m.preco_centavos)}/mês</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleModulo(m)}
                      disabled={savingModulo === m.codigo || m.base_obrigatoria || !m.ativo_global || !m.venda_ativa}
                      className={`mt-3 w-full px-3 py-2 rounded-md text-sm border transition ${
                        m.base_obrigatoria
                          ? "border-slate-200 text-slate-400 bg-slate-50 cursor-default"
                          : "border-rose-200 text-rose-700 hover:bg-rose-50"
                      } disabled:opacity-60`}
                    >
                      {savingModulo === m.codigo ? "Salvando..." : m.base_obrigatoria ? "Módulo base" : "Desativar módulo"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-lg font-semibold text-slate-900">Módulos inativos</h3>
              <p className="text-sm text-slate-500 mt-1">Ative novos módulos conforme necessidade da operação.</p>

              {modulosInativos.length === 0 ? (
                <p className="text-sm text-slate-500 mt-3">Todos os módulos disponíveis já estão ativos.</p>
              ) : (
                <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                  {modulosInativos.map((m) => (
                    <div key={m.codigo} className="min-w-[240px] max-w-[240px] rounded-xl border border-slate-200 bg-white p-3 shrink-0">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-600">
                          {m.imagem_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.imagem_url} alt={nomeApresentacaoModulo(m)} className="h-full w-full object-cover" />
                          ) : (
                            <span>{iniciaisModulo(nomeApresentacaoModulo(m))}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{nomeApresentacaoModulo(m)}</div>
                          <div className="text-xs text-slate-500 mt-1">{m.descricao || m.codigo}</div>
                          <div className="text-xs text-slate-500 mt-1">{categoriaApresentacaoModulo(m)} • {moeda(m.preco_centavos)}/mês</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleModulo(m)}
                        disabled={savingModulo === m.codigo || m.base_obrigatoria || !m.ativo_global || !m.venda_ativa}
                        className={`mt-3 w-full px-3 py-2 rounded-md text-sm border transition ${
                          m.base_obrigatoria
                            ? "border-slate-200 text-slate-400 bg-slate-50 cursor-default"
                            : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        } disabled:opacity-60`}
                      >
                        {savingModulo === m.codigo ? "Salvando..." : m.base_obrigatoria ? "Módulo base" : "Ativar módulo"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {paymentModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 px-4 py-6 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Efetuar pagamento</h3>
                <p className="text-sm text-slate-600 mt-1">Escolha como deseja pagar o valor total da mensalidade.</p>
              </div>
              <button
                type="button"
                onClick={() => void fecharModalPagamento()}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Fechar modal de pagamento"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-3">
              <div className="text-xs text-indigo-700">Resumo da fatura</div>
              <div className="grid sm:grid-cols-3 gap-3 mt-2 text-sm">
                <div>
                  <div className="text-indigo-700/80">Valor bruto</div>
                  <div className="font-semibold text-indigo-900">{moeda(valorBrutoModal)}</div>
                </div>
                <div>
                  <div className="text-indigo-700/80">Desconto</div>
                  <div className="font-semibold text-emerald-700">- {moeda(descontoModal)}</div>
                </div>
                <div>
                  <div className="text-indigo-700/80">Total a pagar</div>
                  <div className="text-lg font-bold text-indigo-900">{moeda(totalModal)}</div>
                </div>
              </div>
              <div className="text-xs text-indigo-700 mt-2">Fatura: {faturaAberta?.id ?? "não encontrada"}</div>
            </div>

            {paymentErro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{paymentErro}</div> : null}
            {paymentMsg ? <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{paymentMsg}</div> : null}
            {couponMsg ? <div className="rounded border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">{couponMsg}</div> : null}

            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="text-sm font-medium text-slate-900">Cupom de desconto</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm uppercase"
                  placeholder="Digite o código do cupom"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  disabled={couponBusy || !faturaAberta}
                  onClick={() => void aplicarCupomDesconto()}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60"
                >
                  {couponBusy ? "Aplicando..." : "Aplicar cupom"}
                </button>
              </div>
              <p className="text-xs text-slate-500">Ao aplicar, o total será recalculado automaticamente conforme as regras do cupom configuradas no painel master.</p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-900">Como deseja pagar?</div>
              <div className="grid sm:grid-cols-3 gap-2">
                {[
                  { value: "pix" as const, label: "PIX" },
                  { value: "cartao" as const, label: "Cartão" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selecionarMetodo(opt.value)}
                    className={`rounded-md border px-3 py-2 text-sm transition ${
                      paymentMethod === opt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "pix" ? (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                {pixQrCode && !pixExpirado ? (
                  <>
                    <Image
                      src={pixQrCode}
                      alt="QR Code PIX"
                      width={192}
                      height={192}
                      className="w-48 h-48 object-contain rounded-lg border border-slate-200 mx-auto"
                    />
                    {pixCopiaCola ? (
                      <div className="text-xs bg-slate-50 border border-slate-200 rounded-md p-2 break-all font-mono">
                        {pixCopiaCola}
                      </div>
                    ) : null}
                    <div className="text-sm text-slate-700">
                      Tempo restante para pagamento: <span className="font-semibold">{tempoPixFormatado()}</span>
                    </div>
                    <div className="text-xs text-slate-500">Verificação automática de pagamento ativa.</div>
                  </>
                ) : (
                  <div className="space-y-2">
                    {pixExpirado ? (
                      <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        O QR code expirou após 5 minutos. Gere um novo QR code para continuar.
                      </div>
                    ) : paymentBusy ? (
                      <div className="text-sm text-slate-600">Gerando QR code PIX...</div>
                    ) : null}
                    <button
                      type="button"
                      disabled={paymentBusy || !faturaAberta}
                      onClick={() => void gerarPixPagamento()}
                      className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60"
                    >
                      {paymentBusy ? "Gerando..." : pixExpirado ? "Gerar novo QR code" : "Gerar QR code PIX"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {paymentMethod === "cartao" ? (
              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="grid md:grid-cols-2 gap-2">
                  <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Nome no cartão" value={cardName} onChange={(e) => setCardName(e.target.value)} />
                  <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Número do cartão" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
                  <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Mês (MM)" value={cardExpMonth} onChange={(e) => setCardExpMonth(e.target.value)} />
                  <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Ano (YYYY)" value={cardExpYear} onChange={(e) => setCardExpYear(e.target.value)} />
                  <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="CVV" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} />
                  <input className="border border-slate-300 rounded-md px-3 py-2 text-sm" placeholder="Parcelas" value={cardInstallments} onChange={(e) => setCardInstallments(e.target.value)} />
                  <input className="border border-slate-300 rounded-md px-3 py-2 text-sm md:col-span-2" placeholder="Documento (CPF/CNPJ)" value={payerDoc} onChange={(e) => setPayerDoc(e.target.value)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={paymentBusy || !faturaAberta}
                    onClick={() => void pagarComCartao()}
                    className="px-4 py-2 rounded-md bg-amber-500 text-slate-900 text-sm hover:bg-amber-400 disabled:opacity-60"
                  >
                    {paymentBusy ? "Processando..." : "Efetuar pagamento"}
                  </button>
                  {cardVerificando ? <span className="text-xs text-slate-500 self-center">Verificação automática ativa.</span> : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => void fecharModalPagamento()}
                className="px-3 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
