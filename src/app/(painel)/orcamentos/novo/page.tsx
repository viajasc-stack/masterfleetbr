"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NovoOrcamentoPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("eventual");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const valor_centavos = valor ? Math.round(parseFloat(valor.replace(',', '.')) * 100) : null;
    const { error } = await supabase.from('orcamentos').insert({ nome, descricao, tipo, valor_centavos }).select().single();
    setLoading(false);
    if (error) {
      alert('Erro ao criar orçamento: ' + error.message);
      return;
    }
    router.push('/orcamentos');
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Novo Orçamento</h2>
      <form onSubmit={salvar} className="bg-white border p-6 rounded-xl">
        <div className="grid gap-4">
          <label>
            <div className="text-sm font-medium mb-1">Nome</div>
            <input value={nome} onChange={(e)=>setNome(e.target.value)} className="w-full border rounded-md px-3 py-2" />
          </label>

          <label>
            <div className="text-sm font-medium mb-1">Descrição</div>
            <textarea value={descricao} onChange={(e)=>setDescricao(e.target.value)} className="w-full border rounded-md px-3 py-2" />
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <select value={tipo} onChange={(e)=>setTipo(e.target.value)} className="w-full border rounded-md px-3 py-2">
              <option value="eventual">Fretamento eventual</option>
              <option value="recorrencia">Recorrência (contrato)</option>
            </select>
          </div>

          <label>
            <div className="text-sm font-medium mb-1">Valor (R$)</div>
            <input value={valor} onChange={(e)=>setValor(e.target.value)} className="w-full border rounded-md px-3 py-2" placeholder="0,00" />
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-md">Salvar</button>
            <button type="button" onClick={()=>router.push('/orcamentos')} className="border px-4 py-2 rounded-md">Cancelar</button>
          </div>
        </div>
      </form>
    </div>
  );
}
