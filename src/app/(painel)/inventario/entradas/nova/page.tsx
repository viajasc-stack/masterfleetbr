"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Produto = { id: string; nome: string; unidade: string; ativo?: boolean };
type Deposito = { id: string; nome: string };
type Fornecedor = { id: string; nome: string; documento: string | null };

type Item = {
  produto_id: string;
  quantidade: string;
  valor_unitario: string;
};

export default function NovaEntradaPage() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [itens, setItens] = useState<Item[]>([{ produto_id: "", quantidade: "", valor_unitario: "" }]);

  const [form, setForm] = useState({
    deposito_id: "",
    fornecedor_id: "",
    nota_fiscal: "",
    data_entrada: new Date().toISOString().slice(0, 10),
    forma_pagamento: "boleto",
    data_vencimento: new Date().toISOString().slice(0, 10),
    parcelado: false,
    qtd_parcelas: "1",
    intervalo_dias_parcelas: "30",
    gerar_conta_pagar: true,
    observacoes: "",
  });

  const [quickProdutoOpen, setQuickProdutoOpen] = useState(false);
  const [quickProdutoLoading, setQuickProdutoLoading] = useState(false);
  const [quickProduto, setQuickProduto] = useState({ nome: "", unidade: "un", categoria: "Outros" });

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function load() {
      setLoadError("");
      const [{ data: p, error: pErr }, { data: d, error: dErr }, { data: f, error: fErr }] = await Promise.all([
        supabase.from("produtos").select("id, nome, unidade, ativo").eq("ativo", true).order("nome"),
        supabase.from("depositos").select("id, nome").order("nome"),
        supabase.from("fornecedores").select("id, nome, documento").eq("ativo", true).order("nome"),
      ]);
      setProdutos((p as Produto[]) ?? []);
      setDepositos((d as Deposito[]) ?? []);
      setFornecedores((f as Fornecedor[]) ?? []);
      const msg = pErr?.message || dErr?.message || fErr?.message;
      if (msg) setLoadError(msg);
    }
    load();
  }, []);

  const totalNota = useMemo(() => {
    return itens.reduce((acc, item) => {
      const qtd = Number(item.quantidade || 0);
      const vlr = Number(item.valor_unitario || 0);
      return acc + qtd * vlr;
    }, 0);
  }, [itens]);

  function setFormField(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setItem(index: number, field: keyof Item, value: string) {
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function adicionarItem() {
    setItens((prev) => [...prev, { produto_id: "", quantidade: "", valor_unitario: "" }]);
  }

  function removerItem(index: number) {
    setItens((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function salvarProdutoRapido(e: React.FormEvent) {
    e.preventDefault();
    if (!quickProduto.nome.trim()) return;
    setQuickProdutoLoading(true);
    const { data, error } = await supabase
      .from("produtos")
      .insert({
        nome: quickProduto.nome.trim(),
        unidade: quickProduto.unidade,
        categoria: quickProduto.categoria,
        ativo: true,
        tipo_item: "peca",
        controla_estoque: true,
      })
      .select("id, nome, unidade, ativo")
      .single();
    setQuickProdutoLoading(false);
    if (error) {
      setErro(error.message);
      return;
    }
    if (data) {
      setProdutos((prev) => [...prev, data as Produto].sort((a, b) => a.nome.localeCompare(b.nome)));
      setItens((prev) => {
        const idx = prev.findIndex((x) => !x.produto_id);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = { ...clone[idx], produto_id: data.id };
          return clone;
        }
        return prev;
      });
    }
    setQuickProdutoOpen(false);
    setQuickProduto({ nome: "", unidade: "un", categoria: "Outros" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.deposito_id) return setErro("Selecione um depósito.");

    const itensValidos = itens
      .map((i) => ({ ...i, quantidadeNum: Number(i.quantidade), valorUnitNum: Number(i.valor_unitario || 0) }))
      .filter((i) => i.produto_id && i.quantidadeNum > 0);

    if (itensValidos.length === 0) return setErro("Adicione pelo menos 1 item válido.");

    setLoading(true);
    setErro("");

    const qtdParcelas = form.parcelado ? Math.max(parseInt(form.qtd_parcelas || "1", 10), 1) : 1;
    const intervalo = form.parcelado ? Math.max(parseInt(form.intervalo_dias_parcelas || "30", 10), 1) : 30;

    const vencimentos: string[] = [];
    for (let i = 0; i < qtdParcelas; i++) {
      const base = new Date(`${form.data_vencimento}T00:00:00`);
      base.setDate(base.getDate() + i * intervalo);
      vencimentos.push(base.toISOString().slice(0, 10));
    }

    const { data: entrada, error: entradaErr } = await supabase
      .from("entradas_estoque")
      .insert({
        deposito_id: form.deposito_id,
        fornecedor_id: form.fornecedor_id || null,
        nota_fiscal: form.nota_fiscal.trim() || null,
        data_entrada: form.data_entrada,
        forma_pagamento: form.forma_pagamento,
        data_vencimento: form.data_vencimento,
        parcelado: form.parcelado,
        qtd_parcelas: qtdParcelas,
        intervalo_dias_parcelas: intervalo,
        vencimentos_parcelas: vencimentos,
        gerar_conta_pagar: form.gerar_conta_pagar,
        valor_total: totalNota,
        observacoes: form.observacoes.trim() || null,
        status: "pendente",
      })
      .select("id")
      .single();

    if (entradaErr || !entrada) {
      setLoading(false);
      return setErro(entradaErr?.message || "Erro ao criar entrada.");
    }

    const itensInsert = itensValidos.map((it) => ({
      entrada_id: entrada.id,
      produto_id: it.produto_id,
      quantidade: it.quantidadeNum,
      valor_unitario: it.valorUnitNum || null,
      valor_total: it.quantidadeNum * it.valorUnitNum,
    }));

    const { error: itensErr } = await supabase.from("entradas_estoque_itens").insert(itensInsert);
    setLoading(false);
    if (itensErr) return setErro(itensErr.message);

    router.push("/inventario/entradas");
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/entradas" className="text-sm text-slate-400 hover:text-white">← Entradas</Link>
        <h1 className="text-xl font-semibold text-white">Nova Entrada (Nota)</h1>
      </div>

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 text-sm">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{erro}</div>}
        {loadError && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">Erro ao carregar dados: {loadError}</div>}

        <div className="grid md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block font-medium mb-1">Fornecedor</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.fornecedor_id} onChange={(e) => setFormField("fornecedor_id", e.target.value)}>
              <option value="">— Selecione —</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.documento ? ` (${f.documento})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Depósito *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.deposito_id} onChange={(e) => setFormField("deposito_id", e.target.value)} required>
              <option value="">— Selecione —</option>
              {depositos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Data Entrada</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.data_entrada} onChange={(e) => setFormField("data_entrada", e.target.value)} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Nota Fiscal</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.nota_fiscal} onChange={(e) => setFormField("nota_fiscal", e.target.value)} />
          </div>
          <div>
            <label className="block font-medium mb-1">Observações</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.observacoes} onChange={(e) => setFormField("observacoes", e.target.value)} />
          </div>
        </div>

        <div className="border rounded-lg border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-semibold">Itens da Nota</h2>
            <div className="flex gap-2">
              <button type="button" onClick={adicionarItem} className="text-xs border border-slate-300 px-2 py-1 rounded">+ Item</button>
              <button type="button" onClick={() => setQuickProdutoOpen(true)} className="text-xs border border-blue-300 text-blue-700 px-2 py-1 rounded">+ Cadastro rápido item</button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {itens.map((item, idx) => (
              <div key={idx} className="grid md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-6">
                  <label className="block text-xs font-medium mb-1">Produto</label>
                  <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={item.produto_id} onChange={(e) => setItem(idx, "produto_id", e.target.value)}>
                    <option value="">— Selecione —</option>
                    {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Qtd.</label>
                  <input type="number" step="0.01" min="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2" value={item.quantidade} onChange={(e) => setItem(idx, "quantidade", e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1">Vlr. Unit.</label>
                  <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2" value={item.valor_unitario} onChange={(e) => setItem(idx, "valor_unitario", e.target.value)} />
                </div>
                <div className="md:col-span-1 text-right font-semibold text-slate-700">
                  {(Number(item.quantidade || 0) * Number(item.valor_unitario || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="md:col-span-1 text-right">
                  <button type="button" onClick={() => removerItem(idx)} className="text-xs border border-red-200 text-red-700 px-2 py-1 rounded">Remover</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 space-y-4">
          <h2 className="font-semibold text-slate-800">Financeiro</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium mb-1">Forma de pagamento</label>
              <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.forma_pagamento} onChange={(e) => setFormField("forma_pagamento", e.target.value)}>
                <option value="avista">À vista</option>
                <option value="pix">PIX</option>
                <option value="boleto">Boleto</option>
                <option value="cartao">Cartão</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">1º vencimento</label>
              <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.data_vencimento} onChange={(e) => setFormField("data_vencimento", e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">Parcelas</label>
              <input type="number" min="1" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.qtd_parcelas} onChange={(e) => setFormField("qtd_parcelas", e.target.value)} disabled={form.forma_pagamento === "avista" || form.forma_pagamento === "pix"} />
            </div>
            <div>
              <label className="block font-medium mb-1">Intervalo (dias)</label>
              <input type="number" min="1" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.intervalo_dias_parcelas} onChange={(e) => setFormField("intervalo_dias_parcelas", e.target.value)} disabled={form.forma_pagamento === "avista" || form.forma_pagamento === "pix"} />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.gerar_conta_pagar} onChange={(e) => setFormField("gerar_conta_pagar", e.target.checked)} />
            <span>Gerar automaticamente no financeiro</span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-slate-700">Valor total da nota: <strong>{totalNota.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">
              {loading ? "Salvando..." : "Registrar Entrada"}
            </button>
            <Link href="/inventario/entradas" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50">Cancelar</Link>
          </div>
        </div>
      </form>

      {quickProdutoOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={salvarProdutoRapido} className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold">Cadastro rápido de item</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={quickProduto.nome} onChange={(e) => setQuickProduto((p) => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Unidade</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={quickProduto.unidade} onChange={(e) => setQuickProduto((p) => ({ ...p, unidade: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Categoria</label>
                <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={quickProduto.categoria} onChange={(e) => setQuickProduto((p) => ({ ...p, categoria: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setQuickProdutoOpen(false)} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={quickProdutoLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60">
                {quickProdutoLoading ? "Salvando..." : "Salvar item"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
