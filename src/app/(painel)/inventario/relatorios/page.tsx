"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage, money, numberBR } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type Resumo = {
  totalItens: number;
  totalCategorias: number;
  totalFornecedores: number;
  totalEntradas: number;
  totalSaidas: number;
  valorEntradas: number;
  qtdSaidas: number;
  valorEstoque: number;
};

type TopItem = {
  id: string;
  nome: string;
  saldo: number;
  custo_medio: number;
};

export default function RelatoriosInventarioPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [resumo, setResumo] = useState<Resumo>({
    totalItens: 0,
    totalCategorias: 0,
    totalFornecedores: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    valorEntradas: 0,
    qtdSaidas: 0,
    valorEstoque: 0,
  });
  const [topItens, setTopItens] = useState<TopItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

        const [
          { count: totalItens },
          { count: totalCategorias },
          { count: totalFornecedores },
          { count: totalEntradas },
          { count: totalSaidas },
          { data: entradasData },
          { data: saidasData },
          { data: itensData },
          { data: estoquesData },
        ] = await Promise.all([
          supabase.from("itens_estoque").select("id", { count: "exact", head: true }).eq("ativo", true),
          supabase.from("categorias_estoque").select("id", { count: "exact", head: true }).eq("ativo", true),
          supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true),
          supabase.from("entradas_estoque").select("id", { count: "exact", head: true }).gte("created_at", inicioMes),
          supabase.from("saidas_estoque").select("id", { count: "exact", head: true }).gte("created_at", inicioMes),
          supabase.from("entradas_estoque").select("valor_total").gte("created_at", inicioMes),
          supabase.from("saidas_estoque").select("quantidade").gte("created_at", inicioMes),
          supabase.from("itens_estoque").select("id, nome, custo_medio").eq("ativo", true),
          supabase.from("estoques").select("item_id, quantidade"),
        ]);

        const valorEntradas = ((entradasData ?? []) as Array<{ valor_total: number | null }>).reduce((acc, i) => acc + Number(i.valor_total ?? 0), 0);
        const qtdSaidas = ((saidasData ?? []) as Array<{ quantidade: number | null }>).reduce((acc, i) => acc + Number(i.quantidade ?? 0), 0);

        const saldosPorItem: Record<string, number> = {};
        ((estoquesData ?? []) as Array<{ item_id: string; quantidade: number | null }>).forEach((s) => {
          saldosPorItem[s.item_id] = (saldosPorItem[s.item_id] ?? 0) + Number(s.quantidade ?? 0);
        });

        const itens = ((itensData ?? []) as Array<{ id: string; nome: string; custo_medio: number | null }>).map((i) => ({
          id: i.id,
          nome: i.nome,
          saldo: Number(saldosPorItem[i.id] ?? 0),
          custo_medio: Number(i.custo_medio ?? 0),
        }));

        const valorEstoque = itens.reduce((acc, i) => acc + i.saldo * i.custo_medio, 0);
        const top = [...itens]
          .sort((a, b) => (b.saldo * b.custo_medio) - (a.saldo * a.custo_medio))
          .slice(0, 10);

        setResumo({
          totalItens: totalItens ?? 0,
          totalCategorias: totalCategorias ?? 0,
          totalFornecedores: totalFornecedores ?? 0,
          totalEntradas: totalEntradas ?? 0,
          totalSaidas: totalSaidas ?? 0,
          valorEntradas,
          qtdSaidas,
          valorEstoque,
        });
        setTopItens(top);
      } catch (e) {
        setErro(errorMessage(e, "Falha ao carregar relatório de estoque."));
      } finally {
        setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const ticketMedioEntrada = useMemo(() => {
    if (!resumo.totalEntradas) return 0;
    return resumo.valorEntradas / resumo.totalEntradas;
  }, [resumo.totalEntradas, resumo.valorEntradas]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Relatórios"
        description="Visão consolidada de movimentação e valor do inventário para análise gerencial."
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      {loading ? <div className="text-sm text-slate-500">Carregando relatório...</div> : null}

      {!loading ? (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Card label="Itens ativos" value={String(resumo.totalItens)} />
            <Card label="Categorias" value={String(resumo.totalCategorias)} />
            <Card label="Fornecedores ativos" value={String(resumo.totalFornecedores)} />
            <Card label="Valor total em estoque" value={money(resumo.valorEstoque)} tone="success" />
            <Card label="Entradas no mês" value={String(resumo.totalEntradas)} />
            <Card label="Valor de entradas" value={money(resumo.valorEntradas)} tone="info" />
            <Card label="Saídas no mês" value={String(resumo.totalSaidas)} />
            <Card label="Qtd saída no mês" value={numberBR(resumo.qtdSaidas, 3)} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Indicadores complementares</h2>
            <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
              <div className="rounded border border-slate-200 p-3">
                <div className="text-slate-500">Ticket médio por entrada (mês)</div>
                <div className="mt-1 font-semibold">{money(ticketMedioEntrada)}</div>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <div className="text-slate-500">Relação saídas / entradas (qtd docs)</div>
                <div className="mt-1 font-semibold">
                  {resumo.totalEntradas > 0 ? numberBR(resumo.totalSaidas / resumo.totalEntradas, 2) : "—"}
                </div>
              </div>
              <div className="rounded border border-slate-200 p-3">
                <div className="text-slate-500">Cobertura média (valor por item)</div>
                <div className="mt-1 font-semibold">
                  {resumo.totalItens > 0 ? money(resumo.valorEstoque / resumo.totalItens) : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 overflow-x-auto shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Top itens por valor em estoque</h2>
            {topItens.length === 0 ? (
              <div className="text-sm text-slate-500">Sem dados para exibir.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4">Saldo</th>
                    <th className="py-2 pr-4">Custo médio</th>
                    <th className="py-2 pr-4">Valor em estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {topItens.map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{it.nome}</td>
                      <td className="py-2 pr-4">{numberBR(it.saldo, 3)}</td>
                      <td className="py-2 pr-4">{money(it.custo_medio)}</td>
                      <td className="py-2 pr-4 font-semibold">{money(it.saldo * it.custo_medio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Card({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "info" }) {
  const cls = tone === "success"
    ? "border-emerald-200 bg-emerald-50"
    : tone === "info"
      ? "border-sky-200 bg-sky-50"
      : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${cls}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
