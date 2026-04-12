"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type MotoristaAppSetting = {
  app_icon_url?: string | null;
};

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function MasterConfiguracoesAppMotoristaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);

  async function carregar() {
    setLoading(true);
    setMsg("");

    const { data, error } = await supabase.rpc("master_get_config_bundle");
    if (error || !data) {
      setMsg(error?.message ?? "Não foi possível carregar as configurações do app motorista.");
      setLoading(false);
      return;
    }

    const settings = (data as { settings?: Record<string, unknown> }).settings ?? {};
    const appCfg = (settings.apps_masterfleetbr_motorista as MotoristaAppSetting | undefined) ?? {};
    setIconUrl(appCfg.app_icon_url ?? "");
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function uploadIcon(file: File) {
    const path = `global/apps/masterfleetbr-motorista/icon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: false, contentType: file.type || "image/png" });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    return data.publicUrl;
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      let nextUrl = iconUrl || null;
      if (iconFile) {
        nextUrl = await uploadIcon(iconFile);
      }

      const { error } = await supabase.rpc("master_upsert_setting", {
        p_key: "apps_masterfleetbr_motorista",
        p_value: {
          app_icon_url: nextUrl,
        },
      });

      if (error) {
        setMsg(error.message);
        setSaving(false);
        return;
      }

      setIconUrl(nextUrl ?? "");
      setIconFile(null);
      setMsg("Configuração do app salva com sucesso.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Erro ao salvar configuração do app.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Aplicativos • MasterFleetBR Motorista</h1>
          <p className="text-sm text-slate-600 mt-0.5">Configurações específicas do app do motorista.</p>
        </div>
        <Link href="/master/configuracoes/aplicativos" className="text-sm text-slate-600 hover:text-slate-900 underline">
          Voltar
        </Link>
      </div>

      {msg ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Ícone do aplicativo</h2>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Observação técnica: esta configuração salva a imagem de ícone para uso em interfaces e futuras automações. O ícone instalado na tela inicial
          do celular normalmente depende de build/publicação da versão nativa do app.
        </div>

        {loading ? <div className="text-sm text-slate-500">Carregando...</div> : null}

        {!loading ? (
          <>
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div className="text-xs text-slate-500 mb-2">Pré-visualização atual</div>
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl} alt="Ícone atual do app" className="h-20 w-20 rounded-xl object-cover border border-slate-200 bg-white" />
              ) : (
                <div className="text-sm text-slate-600">Sem ícone configurado nesta área ainda.</div>
              )}
            </div>

            <form onSubmit={salvar} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Enviar novo ícone</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  onChange={(e) => setIconFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-slate-500 mt-1">Recomendado: PNG quadrado 1024x1024.</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
