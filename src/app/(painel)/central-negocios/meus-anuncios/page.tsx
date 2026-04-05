"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { CardAnuncio } from "@/components/central-negocios/CardAnuncio";
import {
  atualizarStatusAnuncio,
  confirmarDisponibilidade,
  listarAnuncios,
  type NegocioAnuncioListItem,
} from "@/lib/centralNegocios";

export default function MeusAnunciosPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [anuncios, setAnuncios] = useState<NegocioAnuncioListItem[]>([]);

  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const data = await listarAnuncios({ somenteMeus: true, limit: 100 });
      setAnuncios(data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar meus anúncios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function mudarStatus(id: string, status: "ativo" | "pausado" | "inativo" | "vendido") {
    try {
      await atualizarStatusAnuncio(id, status);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar status.");
    }
  }

  async function responderConfirmacao(id: string, resposta: "ainda_disponivel" | "vendido" | "pausar") {
    try {
      await confirmarDisponibilidade(id, resposta);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao confirmar disponibilidade.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus anúncios"
        description="Gerencie seus anúncios e o ciclo de confirmação de disponibilidade."
        actions={<Link href="/central-negocios/novo" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500">Novo anúncio</Link>}
      />

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : anuncios.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Você ainda não publicou anúncios.</div>
      ) : (
        <div className="space-y-4">
          {anuncios.map((a) => (
            <div key={a.id} className="space-y-2">
              <CardAnuncio anuncio={a} showActions={false} />
              <div className="flex flex-wrap gap-2">
                <Link href={`/central-negocios/${a.id}`} className="px-2.5 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-50">Detalhes</Link>
                <button type="button" onClick={() => void mudarStatus(a.id, "ativo")} className="px-2.5 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-50">Ativar</button>
                <button type="button" onClick={() => void mudarStatus(a.id, "pausado")} className="px-2.5 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-50">Pausar</button>
                <button type="button" onClick={() => void mudarStatus(a.id, "vendido")} className="px-2.5 py-1.5 text-xs rounded border border-slate-300 hover:bg-slate-50">Marcar vendido</button>
                {a.status === "aguardando_confirmacao" ? (
                  <>
                    <button type="button" onClick={() => void responderConfirmacao(a.id, "ainda_disponivel")} className="px-2.5 py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-500">Ainda disponível</button>
                    <button type="button" onClick={() => void responderConfirmacao(a.id, "pausar")} className="px-2.5 py-1.5 text-xs rounded bg-amber-600 text-white hover:bg-amber-500">Pausar</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
