"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type TipoServico = {
  id: string;
  nome: string;
  categoria: string | null;
  ativo: boolean;
};

export default function TiposServicoPage() {
  const [loading, setLoading] = useState(true);
  const [tipos, setTipos] = useState<TipoServico[]>([]);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase.from("tipos_servico").select("id,nome,categoria,ativo").order("nome");
    setTipos((data as TipoServico[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, []);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nome.trim()) return;

    if (editingId) {
      await supabase.from("tipos_servico").update({ nome: nome.trim(), categoria: categoria || null }).eq("id", editingId);
    } else {
      await supabase.from("tipos_servico").insert({ nome: nome.trim(), categoria: categoria || null, ativo: true });
    }

    setNome("");
    setCategoria("");
    setEditingId(null);
    await carregar();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("tipos_servico").update({ ativo: !ativo }).eq("id", id);
    await carregar();
  }

  function editar(item: TipoServico) {
    setEditingId(item.id);
    setNome(item.nome);
    setCategoria(item.categoria ?? "");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manutenção · Tipos de serviço" description="CRUD de tipos de serviço com nome e categoria." />

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-3">
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input className="border border-slate-300 rounded-md px-3 py-2" placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        <button type="submit" className="bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500">{editingId ? "Salvar" : "Cadastrar"}</button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Nome</th>
              <th className="py-2 pr-4">Categoria</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="py-3 text-slate-500">Carregando...</td></tr> : null}
            {!loading && tipos.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{t.nome}</td>
                <td className="py-2 pr-4">{t.categoria ?? "—"}</td>
                <td className="py-2 pr-4">{t.ativo ? "Ativo" : "Inativo"}</td>
                <td className="py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button type="button" onClick={() => editar(t)} className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">Editar</button>
                    <button type="button" onClick={() => void toggleAtivo(t.id, t.ativo)} className="px-2 py-1 text-xs border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50">{t.ativo ? "Desativar" : "Ativar"}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
