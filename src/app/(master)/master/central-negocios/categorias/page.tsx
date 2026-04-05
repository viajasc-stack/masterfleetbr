"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Categoria = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
};

type Subcategoria = {
  id: string;
  categoria_id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
};

function slugify(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function MasterCentralNegociosCategoriasPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [categoriaIdNovaSub, setCategoriaIdNovaSub] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    const [cats, subs] = await Promise.all([
      supabase.from("negocio_categorias").select("id, nome, slug, ativa, ordem").order("ordem").order("nome"),
      supabase
        .from("negocio_subcategorias")
        .select("id, categoria_id, nome, slug, ativa, ordem")
        .order("ordem")
        .order("nome"),
    ]);

    if (cats.error || subs.error) {
      setErro(cats.error?.message || subs.error?.message || "Erro ao carregar catálogo.");
      setLoading(false);
      return;
    }

    const categoriasData = (cats.data ?? []) as Categoria[];
    setCategorias(categoriasData);
    setSubcategorias((subs.data ?? []) as Subcategoria[]);
    setCategoriaIdNovaSub((prev) => prev || categoriasData[0]?.id || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  const groupedSubs = useMemo(() => {
    return categorias.map((c) => ({
      categoria: c,
      subcategorias: subcategorias.filter((s) => s.categoria_id === c.id),
    }));
  }, [categorias, subcategorias]);

  async function criarCategoria(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    if (!nome) return;

    setSaving(true);
    setErro("");
    setMsg("");
    const slug = slugify(nome);
    const ordem = Number(fd.get("ordem") || 0);
    const { error } = await supabase.from("negocio_categorias").insert({ nome, slug, ordem, ativa: true });
    setSaving(false);
    if (error) return setErro(error.message);
    setMsg("Categoria criada.");
    (e.currentTarget as HTMLFormElement).reset();
    await carregar();
  }

  async function criarSubcategoria(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    const categoriaId = String(fd.get("categoria_id") || "");
    if (!nome || !categoriaId) return;

    setSaving(true);
    setErro("");
    setMsg("");
    const slug = slugify(nome);
    const ordem = Number(fd.get("ordem") || 0);
    const { error } = await supabase
      .from("negocio_subcategorias")
      .insert({ categoria_id: categoriaId, nome, slug, ordem, ativa: true });
    setSaving(false);
    if (error) return setErro(error.message);
    setMsg("Subcategoria criada.");
    (e.currentTarget as HTMLFormElement).reset();
    await carregar();
  }

  async function toggleCategoria(c: Categoria) {
    setErro("");
    const { error } = await supabase.from("negocio_categorias").update({ ativa: !c.ativa }).eq("id", c.id);
    if (error) return setErro(error.message);
    await carregar();
  }

  async function toggleSubcategoria(s: Subcategoria) {
    setErro("");
    const { error } = await supabase.from("negocio_subcategorias").update({ ativa: !s.ativa }).eq("id", s.id);
    if (error) return setErro(error.message);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Categorias e subcategorias</h1>
        <p className="text-sm text-slate-600 mt-1">Catálogo master da Central de Negócios.</p>
      </div>

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}
      {msg ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div> : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <form onSubmit={criarCategoria} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Nova categoria</h2>
          <input name="nome" placeholder="Nome" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          <input name="ordem" placeholder="Ordem" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" type="number" defaultValue={0} />
          <button disabled={saving} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60">
            {saving ? "Salvando..." : "Criar categoria"}
          </button>
        </form>

        <form onSubmit={criarSubcategoria} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Nova subcategoria</h2>
          <select
            name="categoria_id"
            value={categoriaIdNovaSub}
            onChange={(e) => setCategoriaIdNovaSub(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            required
          >
            <option value="">Selecione a categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <input name="nome" placeholder="Nome" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          <input name="ordem" placeholder="Ordem" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" type="number" defaultValue={0} />
          <button disabled={saving} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60">
            {saving ? "Salvando..." : "Criar subcategoria"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : groupedSubs.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhuma categoria encontrada.</div>
        ) : (
          <div className="space-y-4">
            {groupedSubs.map(({ categoria, subcategorias: subs }) => (
              <div key={categoria.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{categoria.nome}</div>
                    <div className="text-xs text-slate-500">slug: {categoria.slug} • ordem: {categoria.ordem}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleCategoria(categoria)}
                    className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
                  >
                    {categoria.ativa ? "Desativar" : "Ativar"}
                  </button>
                </div>

                <div className="mt-3 grid md:grid-cols-2 gap-2">
                  {subs.length === 0 ? (
                    <div className="text-xs text-slate-500">Sem subcategorias.</div>
                  ) : (
                    subs.map((s) => (
                      <div key={s.id} className="rounded border border-slate-200 px-2 py-2 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm text-slate-800">{s.nome}</div>
                          <div className="text-xs text-slate-500">slug: {s.slug} • ordem: {s.ordem}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleSubcategoria(s)}
                          className="px-2 py-1 text-xs rounded border border-slate-300 hover:bg-slate-50"
                        >
                          {s.ativa ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
