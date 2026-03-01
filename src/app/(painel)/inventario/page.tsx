"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Resumo = {
  total_produtos: number;
  total_depositos: number;
  entradas_pendentes: number;
  movimentos_hoje: number;
};

type Destaque = {
  id: string;
  nome: string;
  unidade: string;
  saldo_total: number;
  estoque_minimo: number | null;
};

export default function InventarioPage() {
  const [resumo, setResumo] = useState<Resumo>({ total_produtos: 0, total_depositos: 0, entradas_pendentes: 0, movimentos_hoje: 0 });
  const [destaques, setDestaques] = useState<Destaque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();

      const [
        { count: totalProdutos },
        { count: totalDepositos },
        { count: entradasPendentes },
        { count: movimentosHoje },
        { data: produtosData },
      ] = await Promise.all([
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("depositos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("entradas_estoque").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("movimentos_estoque").select("id", { count: "exact", head: true }).gte("created_at", inicioHoje),
        supabase.from("produtos")
          .select("id, nome, unidade, estoque_minimo, destaque")
          .eq("ativo", true)
          .eq("destaque", true)
          .limit(3),
      ]);

      setResumo({
        total_produtos: totalProdutos ?? 0,
        total_depositos: totalDepositos ?? 0,
        entradas_pendentes: entradasPendentes ?? 0,
        movimentos_hoje: movimentosHoje ?? 0,
      });

      if (produtosData && produtosData.length > 0) {
        const ids = produtosData.map((p: { id: string }) => p.id);
        const { data: saldos } = await supabase
          .from("saldos_estoque")
          .select("produto_id, quantidade")
          .in("produto_id", ids);

        const saldoMap: Record<string, number> = {};
        (saldos ?? []).forEach((s: { produto_id: string; quantidade: number }) => {
          saldoMap[s.produto_id] = (saldoMap[s.produto_id] ?? 0) + s.quantidade;
        });

        setDestaques(
          produtosData.map((p: { id: string; nome: string; unidade: string; estoque_minimo: number | null }) => ({
            id: p.id,
            nome: p.nome,
            unidade: p.unidade,
            saldo_total: saldoMap[p.id] ?? 0,
            estoque_minimo: p.estoque_minimo,
          }))
        );
      } else {
        setDestaques([]);
      }

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Inventário</h1>
          <p className="text-slate-400 mt-0.5 text-sm">Controle de estoque e movimentações</p>
        </div>
        <Link href="/inventario/entradas/nova" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition">
          + Entrada de Estoque
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Produtos Ativos", value: resumo.total_produtos, href: "/inventario/produtos", cor: "border-slate-700 bg-slate-800/50" },
              { label: "Depósitos", value: resumo.total_depositos, href: "/inventario/depositos", cor: "border-slate-700 bg-slate-800/50" },
              { label: "Entradas Pendentes", value: resumo.entradas_pendentes, href: "/inventario/entradas", cor: "border-amber-500/30 bg-amber-500/10" },
              { label: "Movimentos Hoje", value: resumo.movimentos_hoje, href: "/inventario/movimentos", cor: "border-blue-500/30 bg-blue-500/10" },
            ].map((card) => (
              <Link key={card.href} href={card.href} className={`rounded-xl border ${card.cor} p-5 hover:opacity-90 transition`}>
                <div className="text-3xl font-bold text-white">{card.value}</div>
                <div className="text-sm text-slate-400 mt-1">{card.label}</div>
              </Link>
            ))}
          </div>

          {destaques.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40">
              <div className="px-5 py-4 border-b border-slate-800">
                <span className="text-sm font-semibold text-white">Produtos em Destaque</span>
              </div>
              <div className="divide-y divide-slate-800">
                {destaques.map((d) => {
                  const abaixo = d.estoque_minimo !== null && d.saldo_total < d.estoque_minimo;
                  const pct = d.estoque_minimo && d.estoque_minimo > 0
                    ? Math.min(100, Math.round((d.saldo_total / d.estoque_minimo) * 100))
                    : null;
                  return (
                    <div key={d.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <Link href={`/inventario/produtos/${d.id}`} className="text-sm font-medium text-white hover:underline">
                          {d.nome}
                        </Link>
                        <span className={`text-sm font-semibold ${abaixo ? "text-red-400" : "text-white"}`}>
                          {d.saldo_total} {d.unidade}
                        </span>
                      </div>
                      {pct !== null && (
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${abaixo ? "bg-red-500" : pct < 50 ? "bg-amber-500" : "bg-green-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {abaixo && (
                        <p className="text-xs text-red-400 mt-1">Abaixo do estoque mínimo ({d.estoque_minimo} {d.unidade})</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Produtos", href: "/inventario/produtos", desc: "Cadastrar e gerenciar" },
              { label: "Depósitos", href: "/inventario/depositos", desc: "Locais de armazenagem" },
              { label: "Entradas", href: "/inventario/entradas", desc: "Recebimentos e compras" },
              { label: "Movimentos", href: "/inventario/movimentos", desc: "Histórico (kardex)" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:bg-slate-800/60 transition">
                <div className="text-sm font-semibold text-white">{a.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.desc}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
