"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { supabase } from "@/lib/supabase/client";
import { money } from "@/lib/estoque";
import { EstoqueKpiCard } from "@/components/inventario/EstoqueKpiCard";

type DashboardData = {
  totalItens: number;
  estoqueBaixo: number;
  semEstoque: number;
  valorTotal: number;
  comprasMes: number;
  consumoMes: number;
  fornecedoresAtivos: number;
  movimentacoesPeriodo: number;
};

type CategoriaBar = { categoria: string; total: number };
type MovRecente = { id: string; created_at: string; tipo: string; quantidade: number; item_nome?: string };

export default function InventarioDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [kpis, setKpis] = useState<DashboardData>({
    totalItens: 0,
    estoqueBaixo: 0,
    semEstoque: 0,
    valorTotal: 0,
    comprasMes: 0,
    consumoMes: 0,
    fornecedoresAtivos: 0,
    movimentacoesPeriodo: 0,
  });
  const [categorias, setCategorias] = useState<CategoriaBar[]>([]);
  const [recentes, setRecentes] = useState<MovRecente[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
        const inicio30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [
          { count: totalItens },
          { count: fornecedoresAtivos },
          { count: movimentacoesPeriodo },
          { data: estoquesData },
          { data: itensData },
          { data: entradasMesData },
          { data: saidasMesData },
          { data: movsRecentesData },
        ] = await Promise.all([
          supabase.from("itens_estoque").select("id", { count: "exact", head: true }).eq("ativo", true),
          supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true),
          supabase.from("movimentacoes_estoque").select("id", { count: "exact", head: true }).gte("created_at", inicio30d),
          supabase.from("estoques").select("item_id, quantidade, custo_medio"),
          supabase.from("itens_estoque").select("id, nome, categoria_id, estoque_minimo, categorias_estoque(nome)").eq("ativo", true),
          supabase.from("entradas_estoque").select("valor_total, created_at").gte("created_at", inicioMes),
          supabase.from("saidas_estoque").select("quantidade, created_at").gte("created_at", inicioMes),
          supabase
            .from("movimentacoes_estoque")
            .select("id, created_at, tipo, quantidade, itens_estoque(nome)")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        const saldosPorItem: Record<string, { qtd: number; custo: number }> = {};
        ((estoquesData ?? []) as Array<{ item_id: string; quantidade: number; custo_medio: number | null }>).forEach((s) => {
          const prev = saldosPorItem[s.item_id] ?? { qtd: 0, custo: 0 };
          saldosPorItem[s.item_id] = {
            qtd: prev.qtd + Number(s.quantidade ?? 0),
            custo: prev.custo + Number(s.quantidade ?? 0) * Number(s.custo_medio ?? 0),
          };
        });

        let estoqueBaixo = 0;
        let semEstoque = 0;
        const cats: Record<string, number> = {};

        ((itensData ?? []) as Array<{ id: string; estoque_minimo: number | null; categorias_estoque?: { nome?: string } | null }>).forEach((item) => {
          const saldo = saldosPorItem[item.id]?.qtd ?? 0;
          const minimo = Number(item.estoque_minimo ?? 0);
          if (saldo <= 0) semEstoque += 1;
          if (minimo > 0 && saldo < minimo) estoqueBaixo += 1;
          const catNome = item.categorias_estoque?.nome ?? "Sem categoria";
          cats[catNome] = (cats[catNome] ?? 0) + saldo;
        });

        const valorTotal = Object.values(saldosPorItem).reduce((acc, v) => acc + v.custo, 0);
        const comprasMes = ((entradasMesData ?? []) as Array<{ valor_total: number | null }>).reduce((acc, v) => acc + Number(v.valor_total ?? 0), 0);
        const consumoMes = ((saidasMesData ?? []) as Array<{ quantidade: number | null }>).reduce((acc, v) => acc + Number(v.quantidade ?? 0), 0);

        setKpis({
          totalItens: totalItens ?? 0,
          estoqueBaixo,
          semEstoque,
          valorTotal,
          comprasMes,
          consumoMes,
          fornecedoresAtivos: fornecedoresAtivos ?? 0,
          movimentacoesPeriodo: movimentacoesPeriodo ?? 0,
        });

        setCategorias(
          Object.entries(cats)
            .map(([categoria, total]) => ({ categoria, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 8)
        );

        setRecentes(
          ((movsRecentesData ?? []) as Array<{ id: string; created_at: string; tipo: string; quantidade: number; itens_estoque?: { nome?: string } | null }>).map((m) => ({
            id: m.id,
            created_at: m.created_at,
            tipo: m.tipo,
            quantidade: Number(m.quantidade ?? 0),
            item_nome: m.itens_estoque?.nome ?? "Item",
          }))
        );
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Falha ao carregar dashboard de estoque.");
      } finally {
        setLoading(false);
      }
    }
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const maxCategoria = useMemo(() => Math.max(1, ...categorias.map((c) => c.total)), [categorias]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Dashboard"
        description="Centro de controle operacional do estoque com visão gerencial, alertas e movimentações."
        actions={
          <>
            <Link href="/inventario/entradas" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 transition">
              + Nova entrada
            </Link>
            <Link href="/inventario/compras" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition">
              Compras
            </Link>
          </>
        }
      />

      {erro ? <div className="rounded-md border border-rose-300 bg-rose-50 text-rose-700 text-sm px-3 py-2">{erro}</div> : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando indicadores...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <EstoqueKpiCard label="Total de itens cadastrados" value={kpis.totalItens} href="/inventario/itens" />
            <EstoqueKpiCard label="Itens com estoque baixo" value={kpis.estoqueBaixo} href="/inventario/alertas-reposicao" tone="warning" />
            <EstoqueKpiCard label="Itens sem estoque" value={kpis.semEstoque} href="/inventario/alertas-reposicao" tone="danger" />
            <EstoqueKpiCard label="Valor total do estoque" value={money(kpis.valorTotal)} tone="success" />
            <EstoqueKpiCard label="Compras do mês" value={money(kpis.comprasMes)} href="/inventario/compras" tone="info" />
            <EstoqueKpiCard label="Consumo do mês" value={kpis.consumoMes} href="/inventario/saidas" />
            <EstoqueKpiCard label="Fornecedores ativos" value={kpis.fornecedoresAtivos} href="/inventario/fornecedores" />
            <EstoqueKpiCard label="Movimentações (30 dias)" value={kpis.movimentacoesPeriodo} href="/inventario/movimentacoes" tone="info" />
          </div>

          <div className="grid xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Estoque por categoria</h2>
              {categorias.length === 0 ? (
                <div className="text-sm text-slate-500">Sem dados de categoria para exibir.</div>
              ) : (
                <div className="space-y-3">
                  {categorias.map((cat) => (
                    <div key={cat.categoria}>
                      <div className="text-xs flex justify-between text-slate-600 mb-1">
                        <span>{cat.categoria}</span>
                        <span>{cat.total.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="h-2 rounded bg-slate-100 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.max(2, (cat.total / maxCategoria) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900 mb-4">Alertas rápidos</h2>
              <div className="space-y-3 text-sm">
                <Link href="/inventario/alertas-reposicao" className="block rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                  Itens abaixo do mínimo: <strong>{kpis.estoqueBaixo}</strong>
                </Link>
                <Link href="/inventario/alertas-reposicao" className="block rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                  Itens zerados: <strong>{kpis.semEstoque}</strong>
                </Link>
                <Link href="/inventario/compras" className="block rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700">
                  Acessar compras pendentes
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Últimas movimentações</h2>
              <Link href="/inventario/movimentacoes" className="text-xs text-indigo-700 hover:underline">
                Ver tudo
              </Link>
            </div>
            {recentes.length === 0 ? (
              <div className="text-sm text-slate-500">Sem movimentações recentes.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Data</th>
                      <th className="py-2 pr-4">Item</th>
                      <th className="py-2 pr-4">Tipo</th>
                      <th className="py-2">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentes.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-slate-500">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                        <td className="py-2 pr-4">{m.item_nome}</td>
                        <td className="py-2 pr-4 capitalize">{m.tipo.replaceAll("_", " ")}</td>
                        <td className="py-2 font-medium">{m.quantidade.toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
