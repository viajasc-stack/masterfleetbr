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
  categoria: string | null;
  preco_centavos: number | null;
  ativo: boolean;
  venda_ativa: boolean;
  ordem: number | null;
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
  const [aviso, setAviso] = useState("");
  const [modulo, setModulo] = useState<ModuloRow | null>(null);

  const [nome, setNome] = useState("");
  const [descricaoResumida, setDescricaoResumida] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [preco, setPreco] = useState("0");
  const [ativo, setAtivo] = useState(true);
  const [vendaAtiva, setVendaAtiva] = useState(true);
  const [imagemUrl, setImagemUrl] = useState("");
  const [imagemFile, setImagemFile] = useState<File | null>(null);

  async function carregar() {
    if (!params?.codigo) return;
    setLoading(true);
    setErro("");
    setMsg("");
    setAviso("");

    const { data, error } = await supabase
      .from("modulos_globais")
      .select("codigo, nome, descricao, categoria, preco_centavos, ativo, venda_ativa, ordem, metadata, updated_at")
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
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    setModulo(row);
    setNome(row.nome ?? "");
    setDescricaoResumida(String(metadata.descricao_resumida ?? ""));
    setDescricao(row.descricao ?? "");
    setCategoria(row.categoria ?? "geral");
    setOrdem(String(row.ordem ?? 0));
    setPreco(String((row.preco_centavos ?? 0) / 100));
    setAtivo(Boolean(row.ativo));
    setVendaAtiva(Boolean(row.venda_ativa));
    setImagemUrl(String(metadata.imagem_url ?? ""));
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
    setAviso("");

    const precoNumero = Number(preco.replace(",", "."));
    if (Number.isNaN(precoNumero) || precoNumero < 0) {
      setSaving(false);
      setErro("Informe um valor válido para o módulo.");
      return;
    }

    const ordemNumero = Number(ordem);
    if (Number.isNaN(ordemNumero) || !Number.isFinite(ordemNumero)) {
      setSaving(false);
      setErro("Informe uma ordem válida para o módulo.");
      return;
    }

    const metadataAtual = (modulo.metadata ?? {}) as Record<string, unknown>;
    let imagemPublicUrl = imagemUrl.trim() || null;
    let vendaAtivaFinal = vendaAtiva;

    if (!ativo && vendaAtivaFinal) {
      vendaAtivaFinal = false;
      setAviso("Módulo inativo não pode ficar disponível para venda. A opção de venda foi desativada automaticamente.");
    }

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
      descricao_resumida: descricaoResumida.trim() || null,
    };

    const { error } = await supabase
      .from("modulos_globais")
      .update({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoria: categoria.trim() || "geral",
        ordem: Math.trunc(ordemNumero),
        preco_centavos: Math.round(precoNumero * 100),
        ativo,
        venda_ativa: vendaAtivaFinal,
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

  function onChangeAtivo(checked: boolean) {
    setAtivo(checked);
    if (!checked && vendaAtiva) {
      setVendaAtiva(false);
      setAviso("Como o módulo foi marcado como inativo, a opção de venda foi desligada automaticamente.");
      return;
    }
    setAviso("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Detalhes do módulo</h1>
          <p className="text-sm text-slate-600 mt-1">Edite descrição completa, descrição resumida, valor e status de venda do módulo.</p>
        </div>
        <Link href="/master/modulos" className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
          Voltar
        </Link>
      </div>

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}
      {msg ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div> : null}
      {aviso ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{aviso}</div> : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando módulo...</div>
      ) : !modulo ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Módulo não encontrado.</div>
      ) : (
        <form onSubmit={salvar} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dados comerciais</div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Código</label>
              <input value={modulo.codigo} disabled className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Última atualização</label>
              <input value={new Date(modulo.updated_at).toLocaleString("pt-BR")} disabled className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-slate-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Nome do módulo</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" required />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Descrição resumida</label>
            <input
              value={descricaoResumida}
              onChange={(e) => setDescricaoResumida(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              placeholder="Resumo curto para cards e vitrine"
              maxLength={180}
            />
            <div className="text-[11px] text-slate-500 mt-1">Esse texto será usado em listagens e no site comercial.</div>
            <div className="text-[11px] text-slate-400 mt-1">{descricaoResumida.length}/180 caracteres</div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm min-h-24" />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Categoria</label>
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                placeholder="operacional"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Ordem de exibição</label>
              <input value={ordem} onChange={(e) => setOrdem(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" type="number" step="1" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Valor mensal (R$)</label>
              <input value={preco} onChange={(e) => setPreco(e.target.value)} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" type="number" step="0.01" min="0" required />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Mídia</div>
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

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Status e publicação</div>
              <div className="text-xs font-medium text-slate-700 mb-2">Status do módulo</div>
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={ativo} onChange={(e) => onChangeAtivo(e.target.checked)} />
                  Ativo globalmente
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={vendaAtiva} disabled={!ativo} onChange={(e) => setVendaAtiva(e.target.checked)} />
                  Disponível para venda
                </label>
              </div>
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
