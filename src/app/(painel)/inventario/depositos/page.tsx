"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { PageHeader } from "@/components/ui/PageHeader";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Deposito = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
};

export default function DepositosPage() {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [criando, setCriando] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("depositos").select("*").order("nome");
    setTimeout(() => {
      setDepositos((data as Deposito[]) ?? []);
      setLoading(false);
    }, 0);
  }

  useEffect(() => {
    const id = setTimeout(() => { carregar(); }, 0);
    return () => clearTimeout(id);
  }, []);

  async function criar() {
    if (!formNome.trim()) return;
    setSaving(true);
    await supabase.from("depositos").insert({ nome: formNome.trim(), descricao: formDesc.trim() || null, ativo: true });
    setFormNome(""); setFormDesc(""); setCriando(false); setSaving(false);
    carregar();
  }

  async function salvarEdicao(id: string) {
    if (!novoNome.trim()) return;
    setSaving(true);
    await supabase.from("depositos").update({ nome: novoNome.trim(), descricao: novaDesc.trim() || null }).eq("id", id);
    setEditando(null); setSaving(false);
    carregar();
  }

  async function toggleAtivo(dep: Deposito) {
    await supabase.from("depositos").update({ ativo: !dep.ativo }).eq("id", dep.id);
    carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depósitos"
        description="Locais de armazenagem do estoque."
        actions={
          <button onClick={() => setCriando(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            + Novo Depósito
          </button>
        }
      />

      {criando && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm max-w-lg">
          <h2 className="font-semibold">Novo Depósito</h2>
          <div>
            <label className="block font-medium mb-1">Nome *</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formNome}
              onChange={(e) => setFormNome(e.target.value)} />
          </div>
          <div>
            <label className="block font-medium mb-1">Descrição</label>
            <input className="w-full border border-slate-300 rounded-md px-3 py-2" value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <button onClick={criar} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60 transition">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setCriando(false)} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : depositos.length === 0 ? (
          <div className="text-slate-600">Nenhum depósito cadastrado.</div>
        ) : (
          <div className="space-y-3">
            {depositos.map((d) => (
              <div key={d.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4">
                {editando === d.id ? (
                  <div className="flex-1 flex gap-3">
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm flex-1" value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)} />
                    <input className="border border-slate-300 rounded px-2 py-1 text-sm flex-1" value={novaDesc}
                      onChange={(e) => setNovaDesc(e.target.value)} placeholder="Descrição" />
                    <button onClick={() => salvarEdicao(d.id)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded">Salvar</button>
                    <button onClick={() => setEditando(null)} className="text-sm border border-slate-300 px-3 py-1 rounded">Cancelar</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="font-medium text-sm">{d.nome}</div>
                      {d.descricao && <div className="text-xs text-slate-500">{d.descricao}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-1 rounded border ${d.ativo ? "border-green-200 text-green-700 bg-green-50" : "border-slate-200 text-slate-600 bg-slate-50"}`}>
                        {d.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <button onClick={() => { setEditando(d.id); setNovoNome(d.nome); setNovaDesc(d.descricao ?? ""); }}
                        className="text-xs text-slate-500 hover:text-slate-800 underline">Editar</button>
                      <button onClick={() => toggleAtivo(d)} className="text-xs text-slate-500 hover:text-slate-800 underline">
                        {d.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Link href="/inventario" className="text-sm text-slate-400 hover:text-white">← Voltar ao Inventário</Link>
    </div>
  );
}
