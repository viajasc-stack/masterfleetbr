"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

 

const UNIDADES = ["un", "kg", "L", "m", "m²", "m³", "cx", "pç", "par", "rolo"];
const CATEGORIAS = ["Combustível", "Lubrificante", "Pneus", "Peças", "Ferramentas", "Limpeza", "Escritório", "Outros"];
const TIPOS_ITEM = [
  { value: "peca", label: "Peça mecânica" },
  { value: "pneu", label: "Pneu" },
  { value: "combustivel", label: "Combustível" },
  { value: "oleo_lubrificante", label: "Óleo / Lubrificante" },
  { value: "acessorio", label: "Acessório" },
  { value: "limpeza", label: "Material de limpeza" },
  { value: "servico_terceirizado", label: "Serviço terceirizado" },
  { value: "outro", label: "Outro" },
];

export default function NovoProdutoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "", descricao: "", unidade: "un", categoria: "",
    tipo_item: "peca", codigo_interno: "", codigo_fornecedor: "", controla_estoque: true,
    preco_custo: "", estoque_minimo: "", estoque_maximo: "", destaque: false, ativo: true,
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
      tipo_item: form.tipo_item,
      codigo_interno: form.codigo_interno.trim() || null,
      codigo_fornecedor: form.codigo_fornecedor.trim() || null,
      controla_estoque: form.controla_estoque,
      preco_custo: form.preco_custo ? parseFloat(form.preco_custo) : null,
      estoque_minimo: form.estoque_minimo ? parseFloat(form.estoque_minimo) : null,
      estoque_maximo: form.estoque_maximo ? parseFloat(form.estoque_maximo) : null,
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
            <label className="block font-medium mb-1">Tipo de Item *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.tipo_item}
              onChange={(e) => set("tipo_item", e.target.value)}>
              {TIPOS_ITEM.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Unidade *</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.unidade}
              onChange={(e) => set("unidade", e.target.value)}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Código Interno</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.codigo_interno}
              onChange={(e) => set("codigo_interno", e.target.value)} placeholder="Ex.: PECA-0001" />
          </div>
          <div>
            <label className="block font-medium mb-1">Código Fornecedor</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.codigo_fornecedor}
              onChange={(e) => set("codigo_fornecedor", e.target.value)} placeholder="Código da NF/fornecedor" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Categoria</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}>
              <option value="">— Selecione —</option>
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
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
          <div>
            <label className="block font-medium mb-1">Estoque Máximo</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.estoque_maximo} onChange={(e) => set("estoque_maximo", e.target.value)} placeholder="Ex.: 5000" />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.controla_estoque} onChange={(e) => set("controla_estoque", e.target.checked)} />
            <span>Controla estoque</span>
          </label>
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
