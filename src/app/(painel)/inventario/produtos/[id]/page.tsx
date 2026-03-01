"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const UNIDADES = ["un", "kg", "L", "m", "m²", "m³", "cx", "pç", "par", "rolo"];
const CATEGORIAS = ["Combustível", "Lubrificante", "Pneus", "Peças", "Ferramentas", "Limpeza", "Escritório", "Outros"];

type Movimento = {
  id: string;
  tipo: string;
  quantidade: number;
  origem: string | null;
  created_at: string;
  depositos: { nome: string } | null;
};

export default function EditarProdutoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "", descricao: "", unidade: "un", categoria: "",
    preco_custo: "", estoque_minimo: "", destaque: false, ativo: true,
  });
  const [saldo, setSaldo] = useState<number>(0);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("produtos").select("*").eq("id", id).maybeSingle();
      if (!data) { router.replace("/inventario/produtos"); return; }
      setForm({
        nome: data.nome ?? "",
        descricao: data.descricao ?? "",
        unidade: data.unidade ?? "un",
        categoria: data.categoria ?? "",
        preco_custo: data.preco_custo != null ? String(data.preco_custo) : "",
        estoque_minimo: data.estoque_minimo != null ? String(data.estoque_minimo) : "",
        destaque: data.destaque ?? false,
        ativo: data.ativo ?? true,
      });

      const { data: saldos } = await supabase.from("saldos_estoque").select("quantidade").eq("produto_id", id);
      setSaldo((saldos ?? []).reduce((acc: number, s: { quantidade: number }) => acc + s.quantidade, 0));

      const { data: movs } = await supabase.from("movimentos_estoque")
        .select("id, tipo, quantidade, origem, created_at, depositos(nome)")
        .eq("produto_id", id)
        .order("created_at", { ascending: false })
        .limit(10);
      setMovimentos((movs as unknown as Movimento[]) ?? []);
      setLoading(false);
    }
    load();
  }, [id, router]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErro("");
    const { error } = await supabase.from("produtos").update({
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      unidade: form.unidade,
      categoria: form.categoria || null,
      preco_custo: form.preco_custo ? parseFloat(form.preco_custo) : null,
      estoque_minimo: form.estoque_minimo ? parseFloat(form.estoque_minimo) : null,
      destaque: form.destaque,
      ativo: form.ativo,
    }).eq("id", id);
    setSaving(false);
    if (error) { setErro(error.message); return; }
    router.push("/inventario/produtos");
  }

  if (loading) return <div className="text-slate-400 text-sm">Carregando...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/inventario/produtos" className="text-sm text-slate-400 hover:text-white">← Produtos</Link>
        <h1 className="text-xl font-semibold text-white">{form.nome}</h1>
        <span className="ml-auto text-sm text-slate-400">Saldo atual: <strong className="text-white">{saldo} {form.unidade}</strong></span>
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
            <label className="block font-medium mb-1">Unidade</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.unidade}
              onChange={(e) => set("unidade", e.target.value)}>
              {UNIDADES.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Categoria</label>
            <select className="w-full border border-slate-300 rounded-md px-3 py-2" value={form.categoria}
              onChange={(e) => set("categoria", e.target.value)}>
              <option value="">— Selecione —</option>
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium mb-1">Preço de Custo (R$)</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.preco_custo} onChange={(e) => set("preco_custo", e.target.value)} />
          </div>
          <div>
            <label className="block font-medium mb-1">Estoque Mínimo</label>
            <input type="number" step="0.01" min="0" className="w-full border border-slate-300 rounded-md px-3 py-2"
              value={form.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} />
          </div>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.destaque} onChange={(e) => set("destaque", e.target.checked)} />
            Destaque no dashboard
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={(e) => set("ativo", e.target.checked)} />
            Ativo
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <Link href="/inventario/produtos" className="border border-slate-300 px-6 py-2 rounded-md hover:bg-slate-50 transition">
            Cancelar
          </Link>
        </div>
      </form>

      {movimentos.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold mb-4">Últimos movimentos</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-slate-500">
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Quantidade</th>
                <th className="py-2 pr-4">Depósito</th>
                <th className="py-2">Origem</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-slate-500">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-1 rounded border ${m.tipo === "entrada" ? "border-green-200 text-green-700 bg-green-50" : "border-red-200 text-red-700 bg-red-50"}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-medium">{m.quantidade} {form.unidade}</td>
                  <td className="py-2 pr-4 text-slate-500">{m.depositos?.nome ?? "—"}</td>
                  <td className="py-2 text-slate-500">{m.origem ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
