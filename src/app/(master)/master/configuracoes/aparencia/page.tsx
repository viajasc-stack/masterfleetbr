"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type BrandingSetting = {
  logo_url?: string | null;
};

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function MasterConfiguracoesAparenciaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  async function carregar() {
    setLoading(true);
    setMsg("");
    const { data, error } = await supabase.rpc("master_get_config_bundle");
    if (error || !data) {
      setMsg(error?.message ?? "Não foi possível carregar configurações de aparência.");
      setLoading(false);
      return;
    }

    const settings = (data as { settings?: Record<string, unknown> }).settings ?? {};
    const branding = (settings.branding as BrandingSetting | undefined) ?? {};
    setLogoUrl(branding.logo_url ?? "");
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function uploadLogo(file: File) {
    const path = `global/logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from("branding")
      .upload(path, file, { upsert: false, contentType: file.type || "image/png" });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    return data.publicUrl;
  }

  async function salvarLogo(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      let nextLogoUrl = logoUrl || null;

      if (logoFile) {
        nextLogoUrl = await uploadLogo(logoFile);
      }

      const { error } = await supabase.rpc("master_upsert_setting", {
        p_key: "branding",
        p_value: {
          logo_url: nextLogoUrl,
        },
      });

      if (error) {
        setMsg(error.message);
        setSaving(false);
        return;
      }

      setLogoUrl(nextLogoUrl ?? "");
      setLogoFile(null);
      setMsg("Aparência salva com sucesso. A logo já aparece no login.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Erro ao salvar logo.");
    } finally {
      setSaving(false);
    }
  }

  async function removerLogo() {
    setSaving(true);
    setMsg("");
    const { error } = await supabase.rpc("master_upsert_setting", {
      p_key: "branding",
      p_value: {
        logo_url: null,
      },
    });
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setLogoUrl("");
    setLogoFile(null);
    setMsg("Logo removida. O sistema voltará ao nome padrão.");
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configurações • Aparência</h1>
        <p className="text-sm text-slate-600 mt-0.5">Configure a identidade visual pública do sistema (logo na tela de login).</p>
      </div>

      {msg ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{msg}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900">Logo de login</h2>

        {loading ? <div className="text-sm text-slate-500">Carregando...</div> : null}

        {!loading ? (
          <>
            <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div className="text-xs text-slate-500 mb-2">Pré-visualização atual</div>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo atual" className="max-h-24 w-auto object-contain" />
              ) : (
                <div className="text-sm text-slate-600">Sem logo configurada (usando texto MasterFleetBR).</div>
              )}
            </div>

            <form onSubmit={salvarLogo} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Enviar nova logo</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-slate-500 mt-1">Formatos: PNG, JPG, WEBP ou SVG.</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar aparência"}
                </button>

                <button
                  type="button"
                  onClick={removerLogo}
                  disabled={saving}
                  className="border border-rose-300 text-rose-700 px-4 py-2 rounded-md text-sm hover:bg-rose-50 disabled:opacity-60"
                >
                  Remover logo
                </button>
              </div>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
