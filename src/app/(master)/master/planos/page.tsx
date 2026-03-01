"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Plano = {
  id: string;
  nome: string;
  valor_centavos: number;
  ativo: boolean;
  ordem: number;
};

export default function MasterPlanosPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ nome: "", valor: "", ordem: "" });
  const [saving, setSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("planos").select("*").order("ordem");
    setPlanos((data as Plano[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  async function criar() {
    if (!form.nome.trim()) return;
    setSaving(true);
    await supabase.from("planos").insert({
      nome: form.nome.trim(),
      valor_centavos: form.valor ? Math.round(parseFloat(form.valor) * 100) : 0,
      ordem: form.ordem ? parseInt(form.ordem) : 0,
      ativo: true,
    });
    setForm({ nome: "", valor: "", ordem: "" });
    setCriando(false);
    setSaving(false);
    carregar();
  }

  async function toggleAtivo(p: Plano) {
    await supabase.from("planos").update({ ativo: !p.ativo }).eq("id", p.id);
    carregar();
  }

  const fmt = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Planos</h1>
          <p className="text-slate-400 mt-0.5 text-sm">Planos disponíveis para assinatura</p>
        </div>
        <button onClick={() => setCriando(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm px-4 py-2 rounded-lg transition">
          + Novo Plano
        </button>
      </div>

      {criando && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm max-w-md">
          <h2 className="font-semibold text-white mb-4">Novo Plano</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 mb-1">Nome *</label>
              <input className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm"
                value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Valor mensal (R$)</label>
                <input type="number" step="0.01" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm"
                  value={form.valor} onChange={(e) => setForm((p) => ({ ...p, valor: e.target.value }))} />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Ordem</label>
                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white text-sm"
                  value={form.ordem} onChange={(e) => setForm((p) => ({ ...p, ordem: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={criar} disabled={saving}
                className="bg-amber-500 text-slate-900 font-semibold px-4 py-2 rounded-md text-sm disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setCriando(false)} className="border border-slate-700 text-slate-400 px-4 py-2 rounded-md text-sm hover:text-white transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-500 text-sm">Carregando...</div>
        ) : planos.length === 0 ? (
          <div className="p-6 text-slate-500 text-sm">Nenhum plano cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-5 py-3 text-slate-400 font-medium">Nome</th>
                <th className="px-5 py-3 text-slate-400 font-medium">Valor/mês</th>
                <th className="px-5 py-3 text-slate-400 font-medium">Ordem</th>
                <th className="px-5 py-3 text-slate-400 font-medium">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
                  <td className="px-5 py-3 font-medium text-white">{p.nome}</td>
                  <td className="px-5 py-3 text-white">{fmt(p.valor_centavos)}</td>
                  <td className="px-5 py-3 text-slate-400">{p.ordem}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-1 rounded border ${p.ativo ? "border-green-500/40 text-green-300" : "border-slate-600 text-slate-500"}`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleAtivo(p)} className="text-xs text-slate-500 hover:text-slate-300 underline">
                      {p.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
