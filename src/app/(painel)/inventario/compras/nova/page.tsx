"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadEmpresaModuleAccess } from "@/lib/moduleAccess";
import { registrarEntrada } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type Option = { id: string; nome: string };

type ItemForm = {
  item_id: string;
  quantidade: string;
  valor_unitario: string;
};

function toMoneyNumber(v: string) {
  return Number(v.replace(",", ".") || 0);
}

export default function NovaCompraPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [canUseFinanceiro, setCanUseFinanceiro] = useState(false);

  const [fornecedores, setFornecedores] = useState<Option[]>([]);
  const [itens, setItens] = useState<Option[]>([]);
  const [categorias, setCategorias] = useState<Option[]>([]);
  const [locais, setLocais] = useState<Option[]>([]);

  const [fornecedorId, setFornecedorId] = useState("");
  const [numeroNota, setNumeroNota] = useState("");
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().slice(0, 10));
  const [valorTotalNota, setValorTotalNota] = useState("");
  const [localId, setLocalId] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("boleto");

  const [linhas, setLinhas] = useState<ItemForm[]>([{ item_id: "", quantidade: "", valor_unitario: "" }]);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickRowIndex, setQuickRowIndex] = useState<number | null>(null);
  const [quickNome, setQuickNome] = useState("");
  const [quickCategoriaId, setQuickCategoriaId] = useState("");

  useEffect(() => {
    async function load() {
      const access = await loadEmpresaModuleAccess();
      const podeFinanceiro = access.canUseAllModules || access.allowedModules.includes("financeiro");
      setCanUseFinanceiro(podeFinanceiro);

      const [f, i, c, l] = await Promise.all([
        supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("itens_estoque").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("categorias_estoque").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("locais_estoque").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      setFornecedores((f.data as Option[] | null) ?? []);
      setItens((i.data as Option[] | null) ?? []);
      setCategorias((c.data as Option[] | null) ?? []);
      const locaisList = (l.data as Option[] | null) ?? [];
      setLocais(locaisList);
      if (!localId && locaisList[0]?.id) setLocalId(locaisList[0].id);
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [localId]);

  const totalItens = useMemo(
    () =>
      linhas.reduce((acc, item) => {
        const qtd = toMoneyNumber(item.quantidade);
        const vu = toMoneyNumber(item.valor_unitario);
        return acc + qtd * vu;
      }, 0),
    [linhas]
  );

  function setLinha(index: number, field: keyof ItemForm, value: string) {
    setLinhas((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLinha() {
    setLinhas((prev) => [...prev, { item_id: "", quantidade: "", valor_unitario: "" }]);
  }

  function removeLinha(index: number) {
    setLinhas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function salvarItemRapido(e: FormEvent) {
    e.preventDefault();
    if (!quickNome.trim()) return;
    setQuickSaving(true);

    const { data, error } = await supabase
      .from("itens_estoque")
      .insert({
        nome: quickNome.trim(),
        categoria_id: quickCategoriaId || null,
        ativo: true,
      })
      .select("id, nome")
      .single();

    setQuickSaving(false);

    if (error || !data) {
      setErro(error?.message ?? "Falha ao cadastrar item.");
      return;
    }

    setItens((prev) => [...prev, data as Option].sort((a, b) => a.nome.localeCompare(b.nome)));
    if (quickRowIndex !== null) {
      setLinhas((prev) => prev.map((l, i) => (i === quickRowIndex ? { ...l, item_id: String(data.id) } : l)));
    }
    setQuickOpen(false);
    setQuickNome("");
    setQuickCategoriaId("");
    setQuickRowIndex(null);
  }

  async function salvarCompra(e: FormEvent) {
    e.preventDefault();
    setErro("");

    if (!fornecedorId) return setErro("Selecione o fornecedor.");
    if (!numeroNota.trim()) return setErro("Informe o número da nota.");
    if (!localId) return setErro("Selecione o local de estoque.");

    const itensValidos = linhas
      .map((l) => ({ ...l, qtdNum: toMoneyNumber(l.quantidade), vuNum: toMoneyNumber(l.valor_unitario) }))
      .filter((l) => l.item_id && l.qtdNum > 0);

    if (itensValidos.length === 0) return setErro("Adicione pelo menos 1 item válido.");

    setLoading(true);

    const valorFinalNota = toMoneyNumber(valorTotalNota) > 0 ? toMoneyNumber(valorTotalNota) : totalItens;

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos_compra")
      .insert({
        fornecedor_id: fornecedorId,
        data: `${dataCompra}T12:00:00.000Z`,
        numero_nota: numeroNota.trim(),
        valor_total: valorFinalNota,
        forma_pagamento: canUseFinanceiro ? formaPagamento : null,
        status: "recebido_total",
      })
      .select("id")
      .single();

    if (pedidoErr || !pedido) {
      setLoading(false);
      return setErro(pedidoErr?.message ?? "Falha ao salvar compra.");
    }

    const pedidoId = String(pedido.id);

    const itensPedido = itensValidos.map((l) => ({
      pedido_compra_id: pedidoId,
      item_id: l.item_id,
      quantidade: l.qtdNum,
      valor_unitario: l.vuNum,
      valor_total: l.qtdNum * l.vuNum,
      recebido_quantidade: l.qtdNum,
    }));

    const { error: itensErr } = await supabase.from("pedidos_compra_itens").insert(itensPedido);
    if (itensErr) {
      setLoading(false);
      return setErro(itensErr.message);
    }

    for (const l of itensValidos) {
      const valorTotalItem = l.qtdNum * l.vuNum;
      const { data: entrada, error: entradaErr } = await supabase
        .from("entradas_estoque")
        .insert({
          item_id: l.item_id,
          local_estoque_id: localId,
          fornecedor_id: fornecedorId,
          pedido_compra_id: pedidoId,
          tipo_entrada: "compra",
          quantidade: l.qtdNum,
          valor_unitario: l.vuNum || null,
          valor_total: valorTotalItem || null,
          observacoes: `Compra NF ${numeroNota.trim()}`,
          status: "pendente",
        })
        .select("id")
        .single();

      if (entradaErr || !entrada?.id) {
        setLoading(false);
        return setErro(entradaErr?.message ?? "Falha ao gerar entrada de estoque.");
      }

      try {
        await registrarEntrada(String(entrada.id));
      } catch (rpcError) {
        setLoading(false);
        return setErro(rpcError instanceof Error ? rpcError.message : "Falha ao aplicar entrada no estoque.");
      }
    }

    if (canUseFinanceiro) {
      const fornecedorNome = fornecedores.find((f) => f.id === fornecedorId)?.nome ?? "Fornecedor";
      const hoje = new Date();
      const vencimento = new Date(hoje);
      if (formaPagamento === "boleto") vencimento.setDate(vencimento.getDate() + 30);

      const { error: contaErr } = await supabase.from("contas_financeiras").insert({
        descricao: `Compra NF ${numeroNota.trim()} - ${fornecedorNome}`,
        tipo: "pagar",
        valor: valorFinalNota,
        data_vencimento: vencimento.toISOString().slice(0, 10),
        status: "pendente",
        categoria: "estoque",
        observacoes: `Pedido de compra ${pedidoId} | Forma de pagamento: ${formaPagamento}`,
        entrada_estoque_id: null,
      });

      if (contaErr) {
        setLoading(false);
        return setErro(contaErr.message);
      }
    }

    setLoading(false);
    router.push("/inventario/compras");
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/compras" className="text-sm text-slate-400 hover:text-white">← Compras</Link>
        <h1 className="text-xl font-semibold text-white">Nova compra (nota fiscal)</h1>
      </div>

      <form onSubmit={salvarCompra} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        {erro ? <div className="rounded border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

        <div className="grid md:grid-cols-3 gap-3">
          <select className="border border-slate-300 rounded-md px-3 py-2" value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
            <option value="">Fornecedor</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Número da nota" value={numeroNota} onChange={(e) => setNumeroNota(e.target.value)} />
          <input type="date" className="border border-slate-300 rounded-md px-3 py-2" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
          <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Valor total da nota" value={valorTotalNota} onChange={(e) => setValorTotalNota(e.target.value)} />
          <select className="border border-slate-300 rounded-md px-3 py-2" value={localId} onChange={(e) => setLocalId(e.target.value)}>
            <option value="">Local de estoque</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          {canUseFinanceiro ? (
            <select className="border border-slate-300 rounded-md px-3 py-2" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
              <option value="avista">À vista</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          ) : (
            <div className="text-xs rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">Módulo Financeiro inativo para esta empresa.</div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">Itens da nota</h2>
            <button type="button" onClick={addLinha} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">+ Item</button>
          </div>

          <div className="p-4 space-y-3">
            {linhas.map((linha, index) => (
              <div key={index} className="grid md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-6">
                  <label className="text-xs text-slate-600">Item</label>
                  <div className="flex gap-2">
                    <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={linha.item_id} onChange={(e) => setLinha(index, "item_id", e.target.value)}>
                      <option value="">Selecione</option>
                      {itens.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickRowIndex(index);
                        setQuickOpen(true);
                      }}
                      className="border border-indigo-300 text-indigo-700 rounded px-2 text-xs hover:bg-indigo-50"
                    >
                      + Novo
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600">Qtd</label>
                  <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={linha.quantidade} onChange={(e) => setLinha(index, "quantidade", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-600">Vlr. unit.</label>
                  <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={linha.valor_unitario} onChange={(e) => setLinha(index, "valor_unitario", e.target.value)} />
                </div>
                <div className="md:col-span-1 text-right text-sm font-medium text-slate-700">
                  {(toMoneyNumber(linha.quantidade) * toMoneyNumber(linha.valor_unitario)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="md:col-span-1 text-right">
                  <button type="button" onClick={() => removeLinha(index)} className="text-xs border border-rose-300 text-rose-700 rounded px-2 py-1 hover:bg-rose-50">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-700">
            Total dos itens: <strong>{totalItens.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="bg-indigo-600 text-white rounded-md px-5 py-2 hover:bg-indigo-500 disabled:opacity-60">
              {loading ? "Salvando..." : "Salvar compra"}
            </button>
            <Link href="/inventario/compras" className="border border-slate-300 rounded-md px-5 py-2 hover:bg-slate-50">Cancelar</Link>
          </div>
        </div>
      </form>

      {quickOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <form onSubmit={salvarItemRapido} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-slate-900">Cadastro rápido de item</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Nome do item</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={quickNome} onChange={(e) => setQuickNome(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={quickCategoriaId} onChange={(e) => setQuickCategoriaId(e.target.value)}>
                <option value="">Sem categoria</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setQuickOpen(false)} className="border border-slate-300 rounded-md px-4 py-2 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={quickSaving} className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
                {quickSaving ? "Salvando..." : "Salvar item"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
