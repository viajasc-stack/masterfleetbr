"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

 

const UNIDADES = ["un", "kg", "L", "m", "m²", "m³", "cx", "pç", "par", "rolo"];
const CATEGORIAS = ["Combustível", "Lubrificante", "Pneus", "Peças", "Ferramentas", "Limpeza", "Escritório", "Outros"];

export default function NovoProdutoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "", descricao: "", unidade: "un", categoria: "",
    preco_custo: "", estoque_minimo: "", destaque: false, ativo: true,
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { setErro("Nome é obrigatório."); return; }
    setLoading(true); setErro("");
    const { error } = await supabase.from("produtos").insert({
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      unidade: form.unidade,
      categoria: form.categoria || null,
      preco_custo: form.preco_custo ? parseFloat(form.preco_custo) : null,
      estoque_minimo: form.estoque_minimo ? parseFloat(form.estoque_minimo) : null,
      destaque: form.destaque,
      ativo: form.ativo,
    });
    setLoading(false);
    if (error) { setErro(error.message); return; }
    router.push("/inventario/produtos");
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/produtos" className="text-sm text-slate-400 hover:text-white">← Voltar</Link>
        <h1 className="text-xl font-semibold text-white">Novo Produto</h1>
      </div>

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{erro}</div>}

        <div>
          <label className="block font-medium mb-1">Nome *</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.nome}
            onChange={(e) => set("nome", e.target.value)} required />
        </div>

        <div>
          <label className="block font-medium mb-1">Descrição</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2}
            value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Unidade *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.unidade}
              onChange={(e) => set("unidade", e.target.value)}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Categoria</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}>
              <option value="">— Selecione —</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Preço de Custo (R$)</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.preco_custo} onChange={(e) => set("preco_custo", e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <label className="block font-medium mb-1">Estoque Mínimo</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.destaque} onChange={(e) => set("destaque", e.target.checked)} />
            <span>Destaque no dashboard</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
            <span>Produto ativo</span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? "Salvando..." : "Salvar Produto"}
          </button>
          <Link href="/inventario/produtos" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
