"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { converterSolicitacaoEmOS, dataBR } from "@/lib/manutencao";
import { StatusBadge } from "@/components/manutencao/StatusBadge";

type Preventiva = {
  id: string;
  veiculo_id: string;
  plano_item_id: string;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  status: "em_dia" | "vencendo" | "vencida" | "concluida";
  veiculos: { placa: string | null; km_atual: number | null } | null;
  plano_itens: { intervalo_km: number | null; tipos_servico: { nome: string | null } | null } | null;
};

export default function PreventivaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<Preventiva[]>([]);
  const [filtro, setFiltro] = useState<string>("todos");

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from("preventiva_execucoes")
      .select("id,veiculo_id,plano_item_id,ultima_execucao,proxima_execucao,status,veiculos(placa,km_atual),plano_itens(intervalo_km,tipos_servico(nome))")
      .order("proxima_execucao", { ascending: true });
    setItens((data as Preventiva[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, []);

  const linhas = useMemo(() => itens.filter((i) => (filtro === "todos" ? true : i.status === filtro)), [itens, filtro]);

  async function gerarOS(item: Preventiva) {
    const { data: solicitacao, error } = await supabase
      .from("solicitacoes_manutencao")
      .insert({
        veiculo_id: item.veiculo_id,
        descricao: `Preventiva: ${item.plano_itens?.tipos_servico?.nome ?? "Serviço"}`,
        prioridade: item.status === "vencida" ? "alta" : "media",
        origem: "preventiva",
        km: item.veiculos?.km_atual ?? null,
      })
      .select("id")
      .single();

    if (error || !solicitacao?.id) {
      alert(error?.message ?? "Falha ao gerar solicitação preventiva");
      return;
    }

    const ordemId = await converterSolicitacaoEmOS(solicitacao.id as string);
    router.push(`/manutencao/ordens/${ordemId}`);
  }

  async function marcarConcluida(item: Preventiva) {
    const base = item.proxima_execucao ? new Date(item.proxima_execucao) : new Date();
    const prox = new Date(base);
    prox.setDate(prox.getDate() + 30);

    await supabase
      .from("preventiva_execucoes")
      .update({ status: "concluida", ultima_execucao: new Date().toISOString().slice(0, 10), proxima_execucao: prox.toISOString().slice(0, 10) })
      .eq("id", item.id);

    await carregar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção · Preventiva"
        description="Próximas manutenções preventivas, vencimentos e geração de OS."
        actions={<Link href="/manutencao/planos" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">Planos</Link>}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <select className="border border-slate-300 rounded-md px-3 py-2" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="em_dia">em_dia</option>
          <option value="vencendo">vencendo</option>
          <option value="vencida">vencida</option>
          <option value="concluida">concluida</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Veículo</th>
              <th className="py-2 pr-4">Tipo de manutenção</th>
              <th className="py-2 pr-4">KM atual</th>
              <th className="py-2 pr-4">Próximo vencimento</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-3 text-slate-500">Carregando...</td></tr>
            ) : linhas.length === 0 ? (
              <tr><td colSpan={6} className="py-3 text-slate-500">Nenhum item preventivo.</td></tr>
            ) : (
              linhas.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{p.veiculos?.placa ?? "—"}</td>
                  <td className="py-2 pr-4">{p.plano_itens?.tipos_servico?.nome ?? "—"}</td>
                  <td className="py-2 pr-4">{p.veiculos?.km_atual ?? "—"}</td>
                  <td className="py-2 pr-4">{dataBR(p.proxima_execucao)}</td>
                  <td className="py-2 pr-4"><StatusBadge status={p.status} /></td>
                  <td className="py-2 text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => void gerarOS(p)} className="px-2 py-1 text-xs border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50">Gerar OS</button>
                      <button type="button" onClick={() => void marcarConcluida(p)} className="px-2 py-1 text-xs border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50">Marcar concluída</button>
                    </div>
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
