"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

export default function EditarCategoriaEstoquePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!id) return;
      setLoading(true);
      setErro("");

      const { data, error } = await supabase
        .from("categorias_estoque")
        .select("id, nome, descricao, ativo")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        setErro(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        router.replace("/inventario/categorias");
        return;
      }

      setNome(String(data.nome ?? ""));
      setDescricao(String(data.descricao ?? ""));
      setAtivo(Boolean(data.ativo));
      setLoading(false);
    }

    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, [id, router]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!nome.trim()) return;

    setSaving(true);
    setErro("");
    setOkMsg("");

    const { error } = await supabase
      .from("categorias_estoque")
      .update({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        ativo,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setOkMsg("Categoria atualizada com sucesso.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Editar categoria"
        description="Edite a categoria em tela dedicada para evitar confusão no fluxo."
        actions={<Link href="/inventario/categorias" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">Voltar</Link>}
      />

      {erro ? <div className="rounded-md border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}
      {okMsg ? <div className="rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm px-3 py-2">{okMsg}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando categoria...</div>
      ) : (
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
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      )}
    </div>
  );
}
