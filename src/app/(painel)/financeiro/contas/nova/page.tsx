"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

 

const CATEGORIAS_PAGAR = ["Combustível", "Manutenção", "Salários", "Impostos", "Fornecedores", "Aluguel", "Seguros", "Outros"];
const CATEGORIAS_RECEBER = ["Frete", "Contrato", "Avulso", "Outros"];

export default function NovaContaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    descricao: "",
    tipo: "pagar" as "pagar" | "receber",
    valor: "",
    data_vencimento: new Date().toISOString().slice(0, 10),
    categoria: "",
    observacoes: "",
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descricao.trim()) { setErro("Descrição é obrigatória."); return; }
    if (!form.valor || parseFloat(form.valor) <= 0) { setErro("Valor inválido."); return; }
    setLoading(true); setErro("");
    const { error } = await supabase.from("contas_financeiras").insert({
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      valor: parseFloat(form.valor),
      data_vencimento: form.data_vencimento,
      categoria: form.categoria || null,
      observacoes: form.observacoes.trim() || null,
      status: "pendente",
    });
    setLoading(false);
    if (error) { setErro(error.message); return; }
    router.push("/financeiro");
  }

  const categorias = form.tipo === "pagar" ? CATEGORIAS_PAGAR : CATEGORIAS_RECEBER;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/financeiro" className="text-sm text-slate-400 hover:text-white">← Financeiro</Link>
        <h1 className="text-xl font-semibold text-white">Nova Conta</h1>
      </div>

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm">
        {erro && <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{erro}</div>}

        <div>
          <label className="block font-medium mb-1">Tipo *</label>
          <div className="flex gap-3">
            {(["pagar", "receber"] as const).map((t) => (
              <label key={t} className={`flex-1 flex items-center justify-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition ${form.tipo === t ? t === "pagar" ? "border-red-400 bg-red-50 text-red-700" : "border-green-400 bg-green-50 text-green-700" : "border-slate-300"}`}>
                <input type="radio" name="tipo" value={t} checked={form.tipo === t} onChange={() => { set("tipo", t); set("categoria", ""); }} className="sr-only" />
                {t === "pagar" ? "A Pagar" : "A Receber"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Descrição *</label>
          <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.descricao}
            onChange={(e) => set("descricao", e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Valor (R$) *</label>
            <input type="number" step="0.01" min="0.01" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.valor} onChange={(e) => set("valor", e.target.value)} required />
          </div>
          <div>
            <label className="block font-medium mb-1">Vencimento *</label>
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.data_vencimento} onChange={(e) => set("data_vencimento", e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="block font-medium mb-1">Categoria</label>
          <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.categoria}
            onChange={(e) => set("categoria", e.target.value)}>
            <option value="">— Selecione —</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Observações</label>
          <textarea className="w-full border border-slate-300 rounded-md px-3 py-2 resize-none" rows={2}
            value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? "Salvando..." : "Salvar Conta"}
          </button>
          <Link href="/financeiro" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
