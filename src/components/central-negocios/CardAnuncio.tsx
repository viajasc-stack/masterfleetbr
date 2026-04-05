"use client";

import Link from "next/link";
import { formatarMoedaCentavos, type NegocioAnuncioListItem } from "@/lib/centralNegocios";

type CardAnuncioProps = {
  anuncio: NegocioAnuncioListItem;
  onToggleFavorito?: (id: string) => void;
  showActions?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  aguardando_confirmacao: "Aguardando confirmação",
  pausado: "Pausado",
  inativo: "Inativo",
  vendido: "Vendido",
  removido: "Removido",
};

export function CardAnuncio({ anuncio, onToggleFavorito, showActions = true }: CardAnuncioProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">{anuncio.categoria_nome ?? "Categoria"} • {anuncio.tipo_oportunidade}</div>
          <h3 className="text-base font-semibold text-slate-900 mt-1">{anuncio.titulo}</h3>
          <p className="text-sm text-slate-600 mt-1 line-clamp-2">{anuncio.descricao}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-700 bg-slate-50 whitespace-nowrap">
          {STATUS_LABEL[anuncio.status] ?? anuncio.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="font-semibold text-indigo-700">{formatarMoedaCentavos(anuncio.preco_centavos)}</span>
        <span className="text-slate-500">{anuncio.cidade}/{anuncio.estado}</span>
      </div>

      {showActions ? (
        <div className="mt-4 flex items-center justify-between">
          <Link href={`/central-negocios/${anuncio.id}`} className="text-sm text-indigo-700 hover:underline">
            Ver detalhes
          </Link>
          {onToggleFavorito ? (
            <button
              type="button"
              onClick={() => onToggleFavorito(anuncio.id)}
              className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50"
            >
              {anuncio.favoritado ? "★ Favorito" : "☆ Favoritar"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
