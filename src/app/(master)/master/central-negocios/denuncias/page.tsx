"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DenunciaRow = {
  id: string;
  anuncio_id: string;
  motivo: string;
  descricao: string | null;
  status: "aberta" | "em_analise" | "resolvida" | "arquivada";
  created_at: string;
  negocio_anuncios: {
    id: string;
    titulo: string;
    status: string;
  }[] | null;
};

export default function MasterCentralNegociosDenunciasPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [linhas, setLinhas] = useState<DenunciaRow[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    const { data, error } = await supabase
      .from("negocio_denuncias")
      .select("id, anuncio_id, motivo, descricao, status, created_at, negocio_anuncios(id, titulo, status)")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      setErro(error.message);
      setLinhas([]);
    } else {
      setLinhas((data ?? []) as DenunciaRow[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(t);
  }, [carregar]);

  async function atualizarStatus(id: string, status: DenunciaRow["status"]) {
    setSavingId(id);
    setErro("");
    const { error } = await supabase
      .from("negocio_denuncias")
      .update({ status, tratada_em: new Date().toISOString() })
      .eq("id", id);

    setSavingId(null);
    if (error) {
      setErro(error.message);
      return;
    }

    await carregar();
  }

  async function removerAnuncio(anuncioId: string) {
    setSavingId(anuncioId);
    setErro("");
    const { error } = await supabase.rpc("negocio_atualizar_status_anuncio", {
      p_anuncio_id: anuncioId,
      p_status: "removido",
      p_motivo: "Removido por moderação master",
    });
    setSavingId(null);
    if (error) {
      setErro(error.message);
      return;
    }
    await carregar();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Denúncias</h1>
        <p className="text-sm text-slate-600 mt-1">Fila de moderação da Central de Negócios.</p>
      </div>

      {erro ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</div> : null}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Carregando...</div>
        ) : linhas.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhuma denúncia encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Anúncio</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Motivo</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Descrição</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status denúncia</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 align-top">
                  {/** Relação pode vir como array no retorno tipado do Supabase */}
                  {(() => {
                    const anuncio = d.negocio_anuncios?.[0] ?? null;
                    return (
                      <>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{anuncio?.titulo ?? "Anúncio indisponível"}</div>
                    <div className="text-xs text-slate-500">#{d.anuncio_id.slice(0, 8)} • status anúncio: {anuncio?.status ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{d.motivo}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-sm">{d.descricao || "—"}</td>
                  <td className="px-4 py-3">
                    <select
                      className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                      value={d.status}
                      onChange={(e) => void atualizarStatus(d.id, e.target.value as DenunciaRow["status"])}
                      disabled={savingId === d.id}
                    >
                      <option value="aberta">aberta</option>
                      <option value="em_analise">em_analise</option>
                      <option value="resolvida">resolvida</option>
                      <option value="arquivada">arquivada</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => anuncio?.id && void removerAnuncio(anuncio.id)}
                      disabled={!anuncio?.id || savingId === anuncio.id}
                      className="px-2 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs disabled:opacity-60"
                    >
                      Remover anúncio
                    </button>
                  </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
