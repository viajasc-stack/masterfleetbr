"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function MasterConfiguracoesSitePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [jsonText, setJsonText] = useState("{}");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase
      .from("site_landing_content")
      .select("data, updated_at")
      .eq("slug", "home")
      .maybeSingle();

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setJsonText(JSON.stringify(data?.data ?? {}, null, 2));
    setUpdatedAt(data?.updated_at ?? null);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function salvar() {
    setSaving(true);
    setMsg("");

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setMsg("JSON inválido. Revise a estrutura antes de salvar.");
      setSaving(false);
      return;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setMsg("O conteúdo deve ser um objeto JSON no formato da landing page.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("site_landing_content")
      .upsert({ slug: "home", data: parsed }, { onConflict: "slug" });

    setSaving(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Conteúdo da home salvo com sucesso.");
    await carregar();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Configurações • Site</h1>
          <p className="text-sm text-slate-600 mt-0.5">Edite todo o conteúdo da página inicial pública (index).</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" target="_blank" className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">
            Ver home
          </Link>
          <button onClick={carregar} className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">
            Recarregar
          </button>
        </div>
      </div>

      {msg ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">JSON da landing (slug: home)</h2>
          <div className="text-xs text-slate-500">
            {updatedAt ? `Última atualização: ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Sem atualização registrada"}
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Dica: mantenha as mesmas chaves usadas na home (brand, hero, kpis, features, proofItems, plans, finalCta) para evitar quebra visual.
        </p>

        {loading ? (
          <div className="text-sm text-slate-500">Carregando conteúdo...</div>
        ) : (
          <textarea
            className="w-full min-h-[560px] border border-slate-300 rounded-md px-3 py-2 text-sm font-mono"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={salvar}
            disabled={saving || loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar conteúdo do site"}
          </button>
        </div>
      </section>
    </div>
  );
}
