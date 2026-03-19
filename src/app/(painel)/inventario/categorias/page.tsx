"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type Categoria = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  cor_icone: string | null;
};

export default function CategoriasEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [corIcone, setCorIcone] = useState("");

  async function carregar() {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase
      .from("categorias_estoque")
      .select("id, nome, descricao, ativo, cor_icone")
      .order("nome");

    if (error) setErro(error.message);
    setCategorias((data as Categoria[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function criarCategoria(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    setSaving(true);
    setErro("");

    const { error } = await supabase.from("categorias_estoque").insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      cor_icone: corIcone.trim() || null,
      ativo: true,
    });

    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setNome("");
    setDescricao("");
    setCorIcone("");
    await carregar();
  }

  async function toggleAtivo(item: Categoria) {
    const { error } = await supabase
      .from("categorias_estoque")
      .update({ ativo: !item.ativo })
      .eq("id", item.id);
    if (error) {
      setErro(error.message);
      return;
    }
    await carregar();
  }

  async function excluir(id: string) {
    const ok = window.confirm("Excluir categoria?");
    if (!ok) return;
    const { error } = await supabase.from("categorias_estoque").delete().eq("id", id);
    if (error) {
      setErro(error.message);
      return;
    }
    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Categorias"
        description="Cadastro de categorias para organização inteligente dos itens do estoque."
      />

      {erro ? <div className="rounded-md border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <form onSubmit={criarCategoria} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-4 gap-3">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Cor/ícone (opcional)" value={corIcone} onChange={(e) => setCorIcone(e.target.value)} />
        <button disabled={saving} className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Salvando..." : "+ Nova categoria"}
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : categorias.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhuma categoria cadastrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Nome</th>
                  <th className="py-2 pr-4">Descrição</th>
                  <th className="py-2 pr-4">Cor/ícone</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{c.nome}</td>
                    <td className="py-2 pr-4 text-slate-600">{c.descricao ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{c.cor_icone ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex rounded px-2 py-1 text-xs border ${c.ativo ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-700 bg-slate-50"}`}>
                        {c.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="py-2 text-right space-x-2">
                      <button type="button" className="text-xs px-2 py-1 border border-slate-300 rounded hover:bg-slate-50" onClick={() => toggleAtivo(c)}>
                        {c.ativo ? "Inativar" : "Ativar"}
                      </button>
                      <button type="button" className="text-xs px-2 py-1 border border-rose-200 text-rose-700 rounded hover:bg-rose-50" onClick={() => excluir(c.id)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
