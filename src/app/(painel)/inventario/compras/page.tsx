"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { loadOptions, money, SelectOption } from "@/lib/estoque";
import { EstoqueStatusBadge } from "@/components/inventario/EstoqueStatusBadge";

type Pedido = {
  id: string;
  data: string;
  status: string;
  valor_total: number;
  prazo_entrega: string | null;
  fornecedores?: { nome?: string } | null;
};

export default function ComprasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState<Pedido[]>([]);
  const [fornecedores, setFornecedores] = useState<SelectOption[]>([]);

  const [fornecedorId, setFornecedorId] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    const [fornOpts, pedidosResp] = await Promise.all([
      loadOptions("fornecedores"),
      supabase
        .from("pedidos_compra")
        .select("id, data, status, valor_total, prazo_entrega, fornecedores(nome)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setFornecedores(fornOpts);
    if (pedidosResp.error) setErro(pedidosResp.error.message);
    setLista((pedidosResp.data as Pedido[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criarPedido(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErro("");

    const { error } = await supabase.from("pedidos_compra").insert({
      fornecedor_id: fornecedorId || null,
      status,
      prazo_entrega: prazoEntrega || null,
      forma_pagamento: formaPagamento || null,
      observacoes: observacoes || null,
      valor_total: 0,
    });

    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setFornecedorId("");
    setPrazoEntrega("");
    setFormaPagamento("");
    setObservacoes("");
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Compras"
        description="Fluxo de compras integrado ao estoque: solicitação, aprovação, envio e recebimento." 
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <form onSubmit={criarPedido} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-5 gap-3">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
          <option value="">Fornecedor (opcional)</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <select className="border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="rascunho">Rascunho</option>
          <option value="aguardando_aprovacao">Aguardando aprovação</option>
          <option value="aprovado">Aprovado</option>
          <option value="pedido_enviado">Pedido enviado</option>
        </select>
        <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Forma de pagamento" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <button disabled={saving} className="md:col-span-5 bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Salvando..." : "Criar pedido de compra"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-500">Carregando pedidos...</div> : null}
        {!loading && lista.length === 0 ? <div className="text-sm text-slate-500">Nenhum pedido de compra cadastrado.</div> : null}
        {!loading && lista.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Fornecedor</th>
                <th className="py-2 pr-4">Prazo</th>
                <th className="py-2 pr-4">Valor</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 pr-4 font-medium">{p.fornecedores?.nome ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{p.prazo_entrega ? new Date(p.prazo_entrega).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">{money(p.valor_total)}</td>
                  <td className="py-2"><EstoqueStatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
