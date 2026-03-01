"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

 

type Produto = { id: string; nome: string; unidade: string };
type Deposito = { id: string; nome: string };

export default function NovaEntradaPage() {
  const router = useRouter();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [form, setForm] = useState({
    produto_id: "",
    deposito_id: "",
    quantidade: "",
    valor_unitario: "",
    nota_fiscal: "",
    fornecedor: "",
    data_entrada: new Date().toISOString().slice(0, 10),
    observacoes: "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: d }] = await Promise.all([
        supabase.from("produtos").select("id, nome, unidade").eq("ativo", true).order("nome"),
        supabase.from("depositos").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setProdutos((p as Produto[]) ?? []);
      setDepositos((d as Deposito[]) ?? []);
    }
    load();
  }, []);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.produto_id) { setErro("Selecione um produto."); return; }
    if (!form.deposito_id) { setErro("Selecione um depósito."); return; }
    if (!form.quantidade || parseFloat(form.quantidade) <= 0) { setErro("Quantidade inválida."); return; }

    setLoading(true); setErro("");
    const { error } = await supabase.from("entradas_estoque").insert({
      produto_id: form.produto_id,
      deposito_id: form.deposito_id,
      quantidade: parseFloat(form.quantidade),
      valor_unitario: form.valor_unitario ? parseFloat(form.valor_unitario) : null,
      valor_total: (form.valor_unitario && form.quantidade)
        ? parseFloat(form.valor_unitario) * parseFloat(form.quantidade)
        : null,
      nota_fiscal: form.nota_fiscal.trim() || null,
      fornecedor: form.fornecedor.trim() || null,
      data_entrada: form.data_entrada || null,
      observacoes: form.observacoes.trim() || null,
      status: "pendente",
    });
    setLoading(false);
    if (error) { setErro(error.message); return; }
    router.push("/inventario/entradas");
  }

  const produtoSelecionado = produtos.find((p) => p.id === form.produto_id);

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/entradas" className="text-sm text-slate-400 hover:text-white">← Entradas</Link>
        <h1 className="text-xl font-semibold text-white">Nova Entrada de Estoque</h1>
      </div>

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{erro}</div>}

        <div>
          <label className="block font-medium mb-1">Produto *</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.produto_id}
            onChange={(e) => set("produto_id", e.target.value)} required>
            <option value="">— Selecione —</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Depósito de destino *</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.deposito_id}
            onChange={(e) => set("deposito_id", e.target.value)} required>
            <option value="">— Selecione —</option>
            {depositos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">
              Quantidade {produtoSelecionado ? `(${produtoSelecionado.unidade})` : ""} *
            </label>
            <input type="number" step="0.01" min="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} required />
          </div>
          <div>
            <label className="block font-medium mb-1">Valor Unitário (R$)</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.valor_unitario} onChange={(e) => set("valor_unitario", e.target.value)} placeholder="0,00" />
          </div>
        </div>

        {form.quantidade && form.valor_unitario && (
          <div className="text-sm text-slate-600">
            Valor total: <strong>{(parseFloat(form.quantidade) * parseFloat(form.valor_unitario)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Nota Fiscal</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.nota_fiscal}
              onChange={(e) => set("nota_fiscal", e.target.value)} />
          </div>
          <div>
            <label className="block font-medium mb-1">Data da Entrada</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.data_entrada}
              onChange={(e) => set("data_entrada", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Fornecedor</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.fornecedor}
            onChange={(e) => set("fornecedor", e.target.value)} />
        </div>

        <div>
          <label className="block font-medium mb-1">Observações</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2}
            value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? "Salvando..." : "Registrar Entrada"}
          </button>
          <Link href="/inventario/entradas" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
