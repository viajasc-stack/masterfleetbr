"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";

type RowContrato = {
  contrato_id: string;
  contrato_nome: string;
  receita_total: number;
  custo_total: number;
  margem_total: number;
};

type RowVeiculo = {
  veiculo_id: string;
  veiculo: string;
  total_os: number;
  receita_total: number;
  custo_manutencao: number;
  margem_estimada: number;
};

function moeda(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BiRentabilidadePage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [contratos, setContratos] = useState<RowContrato[]>([]);
  const [veiculos, setVeiculos] = useState<RowVeiculo[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const [{ data: cData, error: cErr }, { data: vData, error: vErr }] = await Promise.all([
          supabase
            .from("v_bi_rentabilidade_contrato")
            .select("contrato_id, contrato_nome, receita_total, custo_total, margem_total")
            .order("margem_total", { ascending: false }),
          supabase
            .from("v_bi_rentabilidade_veiculo")
            .select("veiculo_id, veiculo, total_os, receita_total, custo_manutencao, margem_estimada")
            .order("margem_estimada", { ascending: false }),
        ]);

        if (cErr) throw cErr;
        if (vErr) throw vErr;

        setContratos((cData ?? []) as RowContrato[]);
        setVeiculos((vData ?? []) as RowVeiculo[]);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao carregar BI de rentabilidade.");
      } finally {
        setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const resumo = useMemo(() => {
    const receita = contratos.reduce((s, c) => s + Number(c.receita_total || 0), 0);
    const custo = contratos.reduce((s, c) => s + Number(c.custo_total || 0), 0);
    return { receita, custo, margem: receita - custo };
  }, [contratos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="BI · Rentabilidade"
        description="Margem por contrato e por veículo para apoiar precificação e decisão operacional."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Receita total</div>
          <div className="text-xl font-semibold text-slate-900">{moeda(resumo.receita)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Custo total</div>
          <div className="text-xl font-semibold text-slate-900">{moeda(resumo.custo)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Margem consolidada</div>
          <div className="text-xl font-semibold text-slate-900">{moeda(resumo.margem)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Rentabilidade por contrato</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="py-2 pr-3">Contrato</th>
                    <th className="py-2 pr-3">Receita</th>
                    <th className="py-2 pr-3">Custo</th>
                    <th className="py-2 pr-3">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {contratos.map((c) => (
                    <tr key={c.contrato_id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">{c.contrato_nome || "Sem nome"}</td>
                      <td className="py-2 pr-3">{moeda(c.receita_total)}</td>
                      <td className="py-2 pr-3">{moeda(c.custo_total)}</td>
                      <td className="py-2 pr-3">{moeda(c.margem_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Rentabilidade por veículo</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="py-2 pr-3">Veículo</th>
                    <th className="py-2 pr-3">OS</th>
                    <th className="py-2 pr-3">Receita</th>
                    <th className="py-2 pr-3">Custo manutenção</th>
                    <th className="py-2 pr-3">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {veiculos.map((v) => (
                    <tr key={v.veiculo_id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">{v.veiculo}</td>
                      <td className="py-2 pr-3">{v.total_os}</td>
                      <td className="py-2 pr-3">{moeda(v.receita_total)}</td>
                      <td className="py-2 pr-3">{moeda(v.custo_manutencao)}</td>
                      <td className="py-2 pr-3">{moeda(v.margem_estimada)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
