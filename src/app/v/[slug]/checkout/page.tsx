"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type ViagemResumo = {
  id: string;
  titulo: string;
  valor: number;
  valor_promocional: number | null;
  cidade_destino: string | null;
  venda_online_aberta: boolean;
};

type PassageiroForm = {
  nome: string;
  cpf: string;
  data_nascimento: string;
  telefone: string;
  cidade: string;
  observacao: string;
  responsavel_menor: string;
};

const vazioPassageiro = (): PassageiroForm => ({
  nome: "",
  cpf: "",
  data_nascimento: "",
  telefone: "",
  cidade: "",
  observacao: "",
  responsavel_menor: "",
});

export default function ViagemCheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState<{
    pedido_id: string;
    codigo_acompanhamento: string;
    expires_at: string;
    valor_total: number;
  } | null>(null);
  const [pagamento, setPagamento] = useState<{
    pagamento_id: string;
    gateway: string;
    metodo: string;
    status: string;
    pix_copia_cola: string | null;
    pix_qr_code: string | null;
    expires_at: string | null;
    boleto_url?: string | null;
    checkout_url?: string | null;
  } | null>(null);

  const [viagem, setViagem] = useState<ViagemResumo | null>(null);
  const [quantidade, setQuantidade] = useState(1);

  const [compradorNome, setCompradorNome] = useState("");
  const [compradorCpf, setCompradorCpf] = useState("");
  const [compradorTelefone, setCompradorTelefone] = useState("");
  const [compradorEmail, setCompradorEmail] = useState("");
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao" | "boleto">("pix");
  const [gatewayPreferido, setGatewayPreferido] = useState<"mercado_pago" | "asaas" | "manual">("mercado_pago");

  const [passageiros, setPassageiros] = useState<PassageiroForm[]>([vazioPassageiro()]);

  const valorUnitario = useMemo(() => {
    if (!viagem) return 0;
    return Number(viagem.valor_promocional ?? viagem.valor ?? 0);
  }, [viagem]);

  const valorTotal = useMemo(() => valorUnitario * quantidade, [valorUnitario, quantidade]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!slug) {
          setErro("Link inválido.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.rpc("public_get_viagem_by_slug", { p_slug: slug });
        if (error) {
          setErro("Não foi possível carregar os dados da viagem.");
          setLoading(false);
          return;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          setErro("Viagem não encontrada.");
          setLoading(false);
          return;
        }

        setViagem(row as ViagemResumo);
        setLoading(false);
      })();
    }, 0);

    return () => clearTimeout(id);
  }, [slug]);

  function ajustarQuantidade(novaQuantidade: number) {
    setQuantidade(novaQuantidade);
    setPassageiros((prev) => {
      if (prev.length === novaQuantidade) return prev;
      if (prev.length > novaQuantidade) return prev.slice(0, novaQuantidade);
      return [...prev, ...Array.from({ length: novaQuantidade - prev.length }, () => vazioPassageiro())];
    });
  }

  function setPassageiro(idx: number, key: keyof PassageiroForm, value: string) {
    setPassageiros((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }

  async function finalizar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!slug) return;
    if (!compradorNome.trim()) {
      alert("Informe o nome do comprador.");
      return;
    }

    for (let i = 0; i < passageiros.length; i += 1) {
      if (!passageiros[i].nome.trim()) {
        alert(`Informe o nome do passageiro ${i + 1}.`);
        return;
      }
    }

    setSaving(true);
    setErro("");

    const { data, error } = await supabase.rpc("public_create_pedido_viagem", {
      p_slug: slug,
      p_quantidade: quantidade,
      p_comprador_nome: compradorNome,
      p_comprador_cpf: compradorCpf || null,
      p_comprador_telefone: compradorTelefone || null,
      p_comprador_email: compradorEmail || null,
      p_passageiros: passageiros,
    });

    setSaving(false);

    if (error) {
      setErro(error.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      setErro("Não foi possível gerar o pedido.");
      return;
    }

    setSucesso(row);

    const { data: pagamentoData, error: pagamentoError } = await supabase.rpc("public_iniciar_pagamento_viagem", {
      p_pedido_id: row.pedido_id,
      p_metodo: metodoPagamento,
      p_gateway_preferido: gatewayPreferido,
    });

    if (pagamentoError) {
      setErro(`Pedido criado, mas não foi possível iniciar pagamento: ${pagamentoError.message}`);
      return;
    }

    const payRow = Array.isArray(pagamentoData) ? pagamentoData[0] : null;
    if (payRow) {
      setPagamento(payRow);

      const { data: cobrancaData, error: cobrancaError } = await supabase.functions.invoke("viagem-create-payment", {
        body: {
          pagamento_id: payRow.pagamento_id,
        },
      });

      if (cobrancaError) {
        setErro(`Pagamento iniciado, mas não foi possível gerar cobrança real: ${cobrancaError.message}`);
        return;
      }

      if (cobrancaData) {
        setPagamento((prev) => ({ ...(prev ?? payRow), ...cobrancaData }));
      }
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-100 p-6">Carregando checkout...</div>;

  if (erro && !viagem && !sucesso) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-red-200 bg-white p-6 text-red-700">{erro}</div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-emerald-200 bg-white p-6 space-y-3">
          <h1 className="text-xl font-semibold text-emerald-700">Pedido criado com sucesso!</h1>
          <p className="text-sm text-slate-700">Código de acompanhamento: <span className="font-semibold">{sucesso.codigo_acompanhamento}</span></p>
          <p className="text-sm text-slate-700">Valor total: {Number(sucesso.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
          <p className="text-sm text-slate-700">Reserva válida até: {new Date(sucesso.expires_at).toLocaleString("pt-BR")}</p>
          {pagamento ? (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1">
              <p className="text-sm text-slate-700">Pagamento: <span className="font-medium">{pagamento.gateway} / {pagamento.metodo}</span></p>
              <p className="text-sm text-slate-700">Status: <span className="font-medium">{pagamento.status}</span></p>
              {pagamento.pix_copia_cola ? (
                <p className="text-xs text-slate-600 break-all">PIX copia e cola: {pagamento.pix_copia_cola}</p>
              ) : null}
              {pagamento.expires_at ? (
                <p className="text-xs text-slate-600">Pagamento válido até: {new Date(pagamento.expires_at).toLocaleString("pt-BR")}</p>
              ) : null}
              {pagamento.boleto_url ? (
                <p className="text-xs text-blue-700">
                  Boleto: <a href={pagamento.boleto_url} target="_blank" rel="noreferrer" className="underline">abrir cobrança</a>
                </p>
              ) : null}
              {pagamento.checkout_url ? (
                <p className="text-xs text-blue-700">
                  Checkout: <a href={pagamento.checkout_url} target="_blank" rel="noreferrer" className="underline">pagar agora</a>
                </p>
              ) : null}
            </div>
          ) : null}
          <Link href={`/v/${slug}`} className="inline-block mt-2 px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50 text-sm">
            Voltar para a viagem
          </Link>
          <Link
            href={`/v/pedido/${sucesso.codigo_acompanhamento}`}
            className="inline-block mt-2 ml-2 px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50 text-sm"
          >
            Acompanhar pedido
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <form onSubmit={finalizar} className="max-w-5xl mx-auto space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Checkout • {viagem?.titulo}</h1>
          {!viagem?.venda_online_aberta ? (
            <p className="mt-2 text-sm text-red-700">Vendas online indisponíveis no momento.</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-1">Quantidade de bilhetes</label>
            <input
              type="number"
              min={1}
              max={10}
              value={quantidade}
              onChange={(e) => ajustarQuantidade(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              disabled={!viagem?.venda_online_aberta}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor unitário</label>
            <div className="w-full border border-slate-200 rounded-md px-3 py-2 bg-slate-50 text-slate-700">
              {valorUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total</label>
            <div className="w-full border border-slate-200 rounded-md px-3 py-2 bg-slate-50 font-semibold text-slate-900">
              {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Método de pagamento</label>
            <select
              value={metodoPagamento}
              onChange={(e) => setMetodoPagamento(e.target.value as "pix" | "cartao" | "boleto")}
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              disabled={!viagem?.venda_online_aberta}
            >
              <option value="pix">PIX</option>
              <option value="cartao">Cartão</option>
              <option value="boleto">Boleto</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gateway</label>
            <select
              value={gatewayPreferido}
              onChange={(e) => setGatewayPreferido(e.target.value as "mercado_pago" | "asaas" | "manual")}
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              disabled={!viagem?.venda_online_aberta}
            >
              <option value="mercado_pago">Mercado Pago</option>
              <option value="asaas">Asaas</option>
              <option value="manual">Manual</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-sm font-semibold text-slate-900">Dados do comprador</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Nome *</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={compradorNome} onChange={(e) => setCompradorNome(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">CPF</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={compradorCpf} onChange={(e) => setCompradorCpf(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Telefone</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={compradorTelefone} onChange={(e) => setCompradorTelefone(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <input type="email" className="w-full border border-slate-300 rounded-md px-3 py-2" value={compradorEmail} onChange={(e) => setCompradorEmail(e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Passageiros</h2>
          {passageiros.map((p, idx) => (
            <div key={`pass-${idx + 1}`} className="rounded-lg border border-slate-200 p-4 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-3 text-xs font-semibold text-slate-500">Passageiro {idx + 1}</div>
              <Field label="Nome *" value={p.nome} onChange={(v) => setPassageiro(idx, "nome", v)} />
              <Field label="CPF" value={p.cpf} onChange={(v) => setPassageiro(idx, "cpf", v)} />
              <Field label="Nascimento" type="date" value={p.data_nascimento} onChange={(v) => setPassageiro(idx, "data_nascimento", v)} />
              <Field label="Telefone" value={p.telefone} onChange={(v) => setPassageiro(idx, "telefone", v)} />
              <Field label="Cidade" value={p.cidade} onChange={(v) => setPassageiro(idx, "cidade", v)} />
              <Field label="Responsável (menor)" value={p.responsavel_menor} onChange={(v) => setPassageiro(idx, "responsavel_menor", v)} />
              <div className="md:col-span-3">
                <label className="block text-sm font-medium mb-1">Observação</label>
                <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 min-h-[70px]" value={p.observacao} onChange={(e) => setPassageiro(idx, "observacao", e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        {erro ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !viagem?.venda_online_aberta}
            className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Processando..." : "Finalizar reserva"}
          </button>
          <Link href={`/v/${slug}`} className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
            Voltar
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} className="w-full border border-slate-300 rounded-md px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
