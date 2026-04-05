"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

type ModuloRow = {
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number | null;
  ativo: boolean;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

export default function MasterModuloDetalhePage() {
  const params = useParams<{ codigo: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [modulo, setModulo] = useState<ModuloRow | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("0");
  const [imagemUrl, setImagemUrl] = useState("");
  const [imagemFile, setImagemFile] = useState<File | null>(null);

  async function carregar() {
    if (!params?.codigo) return;
    setLoading(true);
    setErro("");
    setMsg("");

    const { data, error } = await supabase
      .from("modulos_globais")
      .select("codigo, nome, descricao, preco_centavos, ativo, metadata, updated_at")
      .eq("codigo", params.codigo)
      .maybeSingle();

    if (error) {
      setErro(error.message);
      setModulo(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setErro("Módulo não encontrado.");
      setModulo(null);
      setLoading(false);
      return;
    }

    const row = data as ModuloRow;
    setModulo(row);
    setNome(row.nome ?? "");
    setDescricao(row.descricao ?? "");
    setPreco(String((row.preco_centavos ?? 0) / 100));
    setImagemUrl(String((row.metadata?.imagem_url as string | undefined) ?? ""));
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.codigo]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!modulo) return;

    setSaving(true);
    setErro("");
    setMsg("");

    const precoNumero = Number(preco.replace(",", "."));
    if (Number.isNaN(precoNumero) || precoNumero < 0) {
      setSaving(false);
      setErro("Informe um valor válido para o módulo.");
      return;
    }

    const metadataAtual = (modulo.metadata ?? {}) as Record<string, unknown>;
    let imagemPublicUrl = imagemUrl.trim() || null;

    if (imagemFile) {
      setUploading(true);
      const path = `global/modulos/${modulo.codigo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(imagemFile.name)}`;

      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(path, imagemFile, { upsert: false, contentType: imagemFile.type || "image/png" });

      setUploading(false);

      if (uploadError) {
        setSaving(false);
        setErro(uploadError.message);
        return;
      }

      const { data: publicData } = supabase.storage.from("branding").getPublicUrl(path);
      imagemPublicUrl = publicData.publicUrl;
    }

    const metadataNovo: Record<string, unknown> = {
      ...metadataAtual,
      imagem_url: imagemPublicUrl,
    };

    const { error } = await supabase
      .from("modulos_globais")
      .update({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        preco_centavos: Math.round(precoNumero * 100),
        metadata: metadataNovo,
      })
      .eq("codigo", modulo.codigo);

    setSaving(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setMsg("Módulo atualizado com sucesso.");
    setImagemFile(null);
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Detalhes do módulo</h1>
          <p className="text-sm text-slate-600 mt-1">Edite descrição, valor e imagem para uso na Central de Negócios.</p>
        </div>
        <Link href="/master/modulos" className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
          Voltar
        </Link>
      </div>

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}
      {msg ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando módulo...</div>
      ) : !modulo ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Módulo não encontrado.</div>
      ) : (
        <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Código</label>
              <input value={modulo.codigo} disabled className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Status</label>
              <input value={modulo.ativo ? "Ativo" : "Inativo"} disabled className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-slate-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome do módulo</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-24" />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Valor mensal (R$)</label>
              <input value={preco} onChange={(e) => setPreco(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" type="number" step="0.01" min="0" required />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Enviar imagem do módulo</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                onChange={(e) => setImagemFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-slate-500 mt-1">Formatos: PNG, JPG, WEBP ou SVG.</p>
              {imagemUrl.trim() ? (
                <button
                  type="button"
                  onClick={() => {
                    setImagemUrl("");
                    setImagemFile(null);
                  }}
                  className="mt-2 text-xs px-2 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  Remover imagem atual
                </button>
              ) : null}
            </div>
          </div>

          {imagemUrl.trim() || imagemFile ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-500 mb-2">Pré-visualização da imagem</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagemFile ? URL.createObjectURL(imagemFile) : imagemUrl}
                alt={`Imagem do módulo ${nome || modulo.nome}`}
                className="h-32 w-auto rounded border border-slate-200 object-cover"
              />
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button disabled={saving || uploading} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-60">
              {uploading ? "Enviando imagem..." : saving ? "Salvando..." : "Salvar alterações"}
            </button>
            <button type="button" onClick={() => router.push("/master/modulos")} className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
