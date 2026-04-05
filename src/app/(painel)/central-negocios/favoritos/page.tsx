"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CardAnuncio } from "@/components/central-negocios/CardAnuncio";
import { listarAnuncios, toggleFavorito, type NegocioAnuncioListItem } from "@/lib/centralNegocios";

export default function FavoritosCentralNegociosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [anuncios, setAnuncios] = useState<NegocioAnuncioListItem[]>([]);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const data = await listarAnuncios({ somenteFavoritos: true, limit: 100 });
      setAnuncios(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar favoritos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function handleToggleFavorito(id: string) {
    try {
      await toggleFavorito(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar favorito.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Favoritos" description="Anúncios que você marcou para acompanhar." />

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : anuncios.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Nenhum anúncio favoritado.</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {anuncios.map((a) => (
            <CardAnuncio key={a.id} anuncio={a} onToggleFavorito={handleToggleFavorito} />
          ))}
        </div>
      )}
    </div>
  );
}
