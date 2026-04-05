"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

export default function NovaCategoriaEstoquePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;

    setSaving(true);
    setErro("");

    const { error } = await supabase.from("categorias_estoque").insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      ativo,
    });

    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }

    router.push("/inventario/categorias");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Nova categoria"
        description="Crie uma nova categoria em tela dedicada."
        actions={<Link href="/inventario/categorias" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Voltar</Link>}
      />

      {erro ? <div className="rounded-md border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      <form onSubmit={salvar} className="bg-white border border-slate-200 rounded-xl p-5 grid md:grid-cols-2 gap-3">
        <input
          className="border border-slate-300 rounded-md px-3 py-2"
          placeholder="Nome da categoria"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <input
          className="border border-slate-300 rounded-md px-3 py-2"
          placeholder="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        <label className="md:col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Categoria ativa
        </label>

        <button disabled={saving} className="md:col-span-2 bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-500 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar categoria"}
        </button>
      </form>
    </div>
  );
}
