"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContatoAnuncio } from "@/components/central-negocios/ContatoAnuncio";
import { ModalDenuncia } from "@/components/central-negocios/ModalDenuncia";
import {
  atualizarStatusAnuncio,
  detalharAnuncio,
  formatarMoedaCentavos,
  registrarDenuncia,
  toggleFavorito,
  type NegocioAnuncioDetalhe,
} from "@/lib/centralNegocios";
import { useEffect } from "react";

export default function DetalheAnuncioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [denunciaOpen, setDenunciaOpen] = useState(false);
  const [denunciaLoading, setDenunciaLoading] = useState(false);
  const [anuncio, setAnuncio] = useState<NegocioAnuncioDetalhe | null>(null);

  async function carregar() {
    if (!params?.id) return;
    setLoading(true);
    setErro("");
    try {
      const data = await detalharAnuncio(params.id);
      setAnuncio(data);
      if (!data) setErro("Anúncio não encontrado ou sem permissão.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar anúncio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  async function onToggleFavorito() {
    if (!anuncio) return;
    try {
      await toggleFavorito(anuncio.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao favoritar anúncio.");
    }
  }

  async function onMarcarVendido() {
    if (!anuncio) return;
    try {
      await atualizarStatusAnuncio(anuncio.id, "vendido");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar status.");
    }
  }

  if (loading) return <div className="text-sm text-slate-500">Carregando...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={anuncio?.titulo ?? "Detalhe do anúncio"}
        description={anuncio ? `${anuncio.cidade}/${anuncio.estado} • ${anuncio.tipo_oportunidade}` : ""}
        actions={
          anuncio ? (
            <div className="flex gap-2">
              <button type="button" onClick={onToggleFavorito} className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">
                {anuncio.favoritado ? "★ Favorito" : "☆ Favoritar"}
              </button>
              <button type="button" onClick={() => setDenunciaOpen(true)} className="px-3 py-2 text-sm rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50">
                Denunciar
              </button>
              <button type="button" onClick={onMarcarVendido} className="px-3 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">
                Marcar vendido
              </button>
            </div>
          ) : null
        }
      />

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}

      {!anuncio ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Não foi possível visualizar este anúncio.
          <div className="mt-2"><Link href="/central-negocios" className="text-indigo-700 hover:underline">Voltar</Link></div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <div className="text-xs text-slate-500">{anuncio.categoria_nome} {anuncio.subcategoria_nome ? `• ${anuncio.subcategoria_nome}` : ""}</div>
              <div className="text-xl font-semibold text-indigo-700 mt-1">{formatarMoedaCentavos(anuncio.preco_centavos)}</div>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{anuncio.descricao}</p>

            {anuncio.imagens.length > 0 ? (
              <div>
                <div className="text-sm font-medium text-slate-900 mb-2">Imagens</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {anuncio.imagens.map((img, i) => (
                    <div key={`${img.storage_path}-${i}`} className="rounded border border-slate-200 px-2 py-2 text-xs text-slate-600 break-all">
                      {img.storage_path}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <div className="text-sm font-medium text-slate-900">Contatos</div>
              <div className="mt-2"><ContatoAnuncio contatos={anuncio.contatos} /></div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <div>Status: {anuncio.status}</div>
              <div>Publicado em: {anuncio.publicado_em ? new Date(anuncio.publicado_em).toLocaleString("pt-BR") : "—"}</div>
              <div>Atualizado em: {new Date(anuncio.updated_at).toLocaleString("pt-BR")}</div>
            </div>
          </div>
        </div>
      )}

      <ModalDenuncia
        open={denunciaOpen}
        loading={denunciaLoading}
        onClose={() => setDenunciaOpen(false)}
        onSubmit={async ({ motivo, descricao }) => {
          if (!anuncio) return;
          try {
            setDenunciaLoading(true);
            await registrarDenuncia(anuncio.id, motivo, descricao);
            setDenunciaOpen(false);
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao enviar denúncia.");
          } finally {
            setDenunciaLoading(false);
          }
        }}
      />

      <div>
        <button type="button" onClick={() => router.back()} className="text-sm text-indigo-700 hover:underline">← Voltar</button>
      </div>
    </div>
  );
}
