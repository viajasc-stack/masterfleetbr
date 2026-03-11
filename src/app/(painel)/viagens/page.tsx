"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type ViagemStatus =
  | "rascunho"
  | "publicada"
  | "vendas_abertas"
  | "lotada"
  | "encerrada"
  | "finalizada"
  | "cancelada";

type Viagem = {
  id: string;
  codigo: string | null;
  titulo: string;
  categoria: string;
  status: ViagemStatus;
  data_ida: string;
  data_retorno: string | null;
  cidade_saida: string | null;
  cidade_destino: string | null;
  valor: number;
  vendas_ilimitadas: boolean;
  capacidade_total: number | null;
  slug_publico: string | null;
  publicada_em: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<ViagemStatus, string> = {
  rascunho: "Rascunho",
  publicada: "Publicada",
  vendas_abertas: "Vendas abertas",
  lotada: "Lotada",
  encerrada: "Encerrada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

const STATUS_BADGE: Record<ViagemStatus, string> = {
  rascunho: "border-slate-200 text-slate-700 bg-slate-50",
  publicada: "border-blue-200 text-blue-700 bg-blue-50",
  vendas_abertas: "border-emerald-200 text-emerald-700 bg-emerald-50",
  lotada: "border-amber-200 text-amber-700 bg-amber-50",
  encerrada: "border-slate-200 text-slate-700 bg-slate-50",
  finalizada: "border-indigo-200 text-indigo-700 bg-indigo-50",
  cancelada: "border-red-200 text-red-700 bg-red-50",
};

type FiltroStatus = "todos" | ViagemStatus;

export default function ViagensPage() {
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");

  async function carregar() {
    setLoading(true);
    setErro("");

    const { data, error } = await supabase
      .from("viagens")
      .select(
        "id,codigo,titulo,categoria,status,data_ida,data_retorno,cidade_saida,cidade_destino,valor,vendas_ilimitadas,capacidade_total,slug_publico,publicada_em,created_at",
      )
      .order("data_ida", { ascending: true });

    if (error) {
      setErro(error.message);
      setViagens([]);
      setLoading(false);
      return;
    }

    setViagens((data ?? []) as Viagem[]);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);

    return () => clearTimeout(id);
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return viagens
      .filter((v) => (filtroStatus === "todos" ? true : v.status === filtroStatus))
      .filter((v) => {
        if (!q) return true;
        return [v.titulo, v.codigo ?? "", v.cidade_saida ?? "", v.cidade_destino ?? "", v.categoria]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [viagens, busca, filtroStatus]);

  async function publicar(v: Viagem) {
    setProcessingId(v.id);
    const { data, error } = await supabase.rpc("rpc_viagens_publicar", {
      p_viagem_id: v.id,
      p_slug_sugerido: v.slug_publico,
    });
    setProcessingId(null);

    if (error || !data) {
      alert(`Erro ao publicar viagem: ${error?.message ?? "falha desconhecida"}`);
      return;
    }

    await carregar();
    alert("Viagem publicada com sucesso.");
  }

  async function copiarLinkPublico(v: Viagem) {
    if (!v.slug_publico) {
      alert("Esta viagem ainda não possui link público. Clique em Publicar primeiro.");
      return;
    }
    const link = `${window.location.origin}/v/${v.slug_publico}`;
    try {
      await navigator.clipboard.writeText(link);
      alert("Link público copiado com sucesso.");
    } catch {
      alert("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Viagens"
        description="Cadastre e acompanhe as viagens/excursões da sua empresa."
        actions={
          <>
            <Link href="/viagens/nova" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
              + Nova Viagem
            </Link>
            <button onClick={carregar} className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Recarregar
            </button>
          </>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2"
              placeholder="Título, código, origem, destino..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
              className="w-full border border-slate-300 rounded-md px-3 py-2"
            >
              <option value="todos">Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="publicada">Publicada</option>
              <option value="vendas_abertas">Vendas abertas</option>
              <option value="lotada">Lotada</option>
              <option value="encerrada">Encerrada</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {erro ? <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">Erro: {erro}</div> : null}

        {loading ? (
          <div className="text-slate-600">Carregando viagens...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-slate-600">Nenhuma viagem encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Viagem</th>
                  <th className="py-2 pr-4">Período</th>
                  <th className="py-2 pr-4">Rota</th>
                  <th className="py-2 pr-4">Capacidade</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-0">Status</th>
                  <th className="py-2 pr-0 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((v) => (
                  <tr key={v.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-slate-900">{v.titulo}</div>
                      <div className="text-xs text-slate-500">{v.codigo ?? `#${v.id.slice(0, 8)}`} • {v.categoria}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <div>{new Date(`${v.data_ida}T00:00:00`).toLocaleDateString("pt-BR")}</div>
                      <div className="text-xs text-slate-500">
                        Retorno: {v.data_retorno ? new Date(`${v.data_retorno}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                      </div>
                    </td>
                    <td className="py-2 pr-4">{v.cidade_saida ?? "—"} → {v.cidade_destino ?? "—"}</td>
                    <td className="py-2 pr-4">{v.vendas_ilimitadas ? "Ilimitada" : v.capacidade_total ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {Number(v.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="py-2 pr-0">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${STATUS_BADGE[v.status]}`}>
                        {STATUS_LABEL[v.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex gap-2">
                        <Link
                          href={`/viagens/${v.id}`}
                          className="px-2.5 py-1 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                        >
                          Detalhes
                        </Link>
                        <Link
                          href={`/viagens/${v.id}/pedidos`}
                          className="px-2.5 py-1 text-xs border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-50"
                        >
                          Pedidos
                        </Link>
                        <button
                          type="button"
                          onClick={() => publicar(v)}
                          disabled={processingId === v.id}
                          className="px-2.5 py-1 text-xs border border-blue-200 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50"
                        >
                          {processingId === v.id ? "Publicando..." : v.publicada_em ? "Republicar" : "Publicar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => copiarLinkPublico(v)}
                          className="px-2.5 py-1 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50"
                        >
                          Copiar link
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
