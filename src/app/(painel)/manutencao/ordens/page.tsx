"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { moeda } from "@/lib/manutencao";
import { StatusBadge } from "@/components/manutencao/StatusBadge";

type Ordem = {
  id: string;
  status: "aberta" | "analise" | "aguardando_pecas" | "andamento" | "finalizada";
  tipo: "corretiva" | "preventiva" | "emergencial";
  prioridade: "baixa" | "media" | "alta";
  diagnostico: string | null;
  km: number | null;
  custo_total: number;
  data_abertura: string;
  data_conclusao: string | null;
  veiculos: { placa: string | null; modelo: string | null } | null;
};

export default function OrdensManutencaoPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [ordens, setOrdens] = useState<Ordem[]>([]);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("ordens_manutencao")
      .select("id,status,tipo,prioridade,diagnostico,km,custo_total,data_abertura,data_conclusao,veiculos(placa,modelo)")
      .order("data_abertura", { ascending: false })
      .limit(400);
    setOrdens((data as Ordem[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ordens
      .filter((o) => (status === "todos" ? true : o.status === status))
      .filter((o) => {
        if (!q) return true;
        return [o.veiculos?.placa ?? "", o.veiculos?.modelo ?? "", o.tipo, o.prioridade, o.diagnostico ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [ordens, status, busca]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Ordens"
        description="Ordens de manutenção com filtros por status e acesso ao detalhe completo."
        actions={
          <Link href="/manutencao/solicitacoes" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">
            Solicitações
          </Link>
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 grid gap-3 md:grid-cols-3">
        <input className="md:col-span-2 border border-slate-300 rounded-md px-3 py-2" placeholder="Buscar por veículo, tipo, diagnóstico" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select className="border border-slate-300 rounded-md px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="aberta">aberta</option>
          <option value="analise">analise</option>
          <option value="aguardando_pecas">aguardando_pecas</option>
          <option value="andamento">andamento</option>
          <option value="finalizada">finalizada</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Veículo</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Prioridade</th>
              <th className="py-2 pr-4">Diagnóstico</th>
              <th className="py-2 pr-4">Abertura</th>
              <th className="py-2 pr-4">Custo</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="py-3 text-slate-500">Carregando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={8} className="py-3 text-slate-500">Nenhuma ordem encontrada.</td></tr>
            ) : (
              filtradas.map((o) => (
                <tr key={o.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-4 font-medium">{o.veiculos?.placa ?? "—"}</td>
                  <td className="py-2 pr-4">{o.tipo}</td>
                  <td className="py-2 pr-4">{o.prioridade}</td>
                  <td className="py-2 pr-4 max-w-[280px]">{o.diagnostico ?? "—"}</td>
                  <td className="py-2 pr-4">{new Date(o.data_abertura).toLocaleDateString("pt-BR")}</td>
                  <td className="py-2 pr-4">{moeda(o.custo_total)}</td>
                  <td className="py-2 pr-4"><StatusBadge status={o.status} /></td>
                  <td className="py-2 text-right">
                    <Link href={`/manutencao/ordens/${o.id}`} className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50">
                      Detalhar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
