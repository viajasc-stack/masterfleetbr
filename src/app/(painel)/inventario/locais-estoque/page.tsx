"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type LocalEstoque = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export default function LocaisEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [locais, setLocais] = useState<LocalEstoque[]>([]);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase.from("locais_estoque").select("id, nome, descricao, ativo").order("nome");
    if (error) setErro(error.message);
    setLocais((data as LocalEstoque[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("locais_estoque").insert({ nome: nome.trim(), descricao: descricao.trim() || null, ativo: true });
    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setNome("");
    setDescricao("");
    await carregar();
  }

  async function toggle(local: LocalEstoque) {
    const { error } = await supabase.from("locais_estoque").update({ ativo: !local.ativo }).eq("id", local.id);
    if (error) return setErro(error.message);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque · Locais de Estoque" description="Gerencie almoxarifados, filiais, oficina e demais locais de armazenagem." />
      {erro ? <div className="text-sm text-rose-700 bg-rose-50 border border-rose-300 rounded px-3 py-2">{erro}</div> : null}

      <form onSubmit={criar} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-3 gap-3">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome do local" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <button disabled={saving} className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Salvando..." : "+ Novo local"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {loading ? <div className="text-sm text-slate-500">Carregando...</div> : null}
        {!loading && locais.length === 0 ? <div className="text-sm text-slate-500">Nenhum local cadastrado.</div> : null}
        {!loading && locais.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">Descrição</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {locais.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{l.nome}</td>
                  <td className="py-2 pr-4 text-slate-600">{l.descricao ?? "—"}</td>
                  <td className="py-2 pr-4">{l.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => void toggle(l)} className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50">
                      {l.ativo ? "Inativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
