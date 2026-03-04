"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Resumo = {
  total_produtos: number;
  total_depositos: number;
  entradas_pendentes: number;
  movimentos_hoje: number;
};

type Destaque = {
  id: string;
  nome: string;
  tipo_item: string;
  unidade: string;
  saldo_total: number;
  estoque_minimo: number | null;
  estoque_maximo: number | null;
};

type SerieDia = {
  dia: string;
  entradas: number;
  saidas: number;
};

export default function InventarioPage() {
  const [resumo, setResumo] = useState<Resumo>({ total_produtos: 0, total_depositos: 0, entradas_pendentes: 0, movimentos_hoje: 0 });
  const [destaques, setDestaques] = useState<Destaque[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [valorEntradasMes, setValorEntradasMes] = useState(0);
  const [itensAbaixoMinimo, setItensAbaixoMinimo] = useState(0);
  const [serieMovimentos, setSerieMovimentos] = useState<SerieDia[]>([]);
  const [tanquesCombustivel, setTanquesCombustivel] = useState<Destaque[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError("");

      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();

      const [
        { count: totalProdutos },
        { count: totalDepositos },
        { count: entradasPendentes },
        { count: movimentosHoje },
        { data: produtosData, error: produtosDataErr },
        { data: entradasMesData },
        { data: movimentosRecentesData },
        { data: produtosComMinimoData },
      ] = await Promise.all([
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("depositos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("entradas_estoque").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("movimentos_estoque").select("id", { count: "exact", head: true }).gte("created_at", inicioHoje),
        supabase.from("produtos")
          .select("id, nome, tipo_item, unidade, estoque_minimo, estoque_maximo, destaque")
          .eq("ativo", true)
          .eq("destaque", true)
          .limit(8),
        supabase.from("entradas_estoque").select("valor_total, created_at").gte("created_at", new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()),
        supabase.from("movimentos_estoque").select("tipo, quantidade, created_at").gte("created_at", new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6).toISOString()),
        supabase.from("produtos").select("id, estoque_minimo").eq("ativo", true).not("estoque_minimo", "is", null),
      ]);

      if (produtosDataErr) setLoadError(produtosDataErr.message);

      setResumo({
        total_produtos: totalProdutos ?? 0,
        total_depositos: totalDepositos ?? 0,
        entradas_pendentes: entradasPendentes ?? 0,
        movimentos_hoje: movimentosHoje ?? 0,
      });

      setValorEntradasMes(
        ((entradasMesData as Array<{ valor_total: number | null }> | null) ?? []).reduce((acc, e) => acc + Number(e.valor_total ?? 0), 0)
      );

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

        const listaDestaques = produtosData.map((p: { id: string; nome: string; tipo_item: string; unidade: string; estoque_minimo: number | null; estoque_maximo: number | null }) => ({
            id: p.id,
            nome: p.nome,
            tipo_item: p.tipo_item,
            unidade: p.unidade,
            saldo_total: saldoMap[p.id] ?? 0,
            estoque_minimo: p.estoque_minimo,
            estoque_maximo: p.estoque_maximo,
          }));

        setDestaques(listaDestaques);
        setTanquesCombustivel(
          listaDestaques.filter((p) => p.tipo_item === "combustivel" && p.estoque_maximo !== null && p.estoque_maximo > 0)
        );
      } else {
        setDestaques([]);
        setTanquesCombustivel([]);
      }

      if (produtosComMinimoData && produtosComMinimoData.length > 0) {
        const idsMinimo = produtosComMinimoData.map((p: { id: string }) => p.id);
        const { data: saldosMin } = await supabase
          .from("saldos_estoque")
          .select("produto_id, quantidade")
          .in("produto_id", idsMinimo);

        const saldoMapMin: Record<string, number> = {};
        (saldosMin ?? []).forEach((s: { produto_id: string; quantidade: number }) => {
          saldoMapMin[s.produto_id] = (saldoMapMin[s.produto_id] ?? 0) + s.quantidade;
        });

        const abaixo = (produtosComMinimoData as Array<{ id: string; estoque_minimo: number | null }>).filter((p) => {
          const minimo = Number(p.estoque_minimo ?? 0);
          return (saldoMapMin[p.id] ?? 0) < minimo;
        }).length;
        setItensAbaixoMinimo(abaixo);
      } else {
        setItensAbaixoMinimo(0);
      }

      const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const seriesMap = new Map<string, SerieDia>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        seriesMap.set(key, { dia: labels[d.getDay()], entradas: 0, saidas: 0 });
      }

      (movimentosRecentesData as Array<{ tipo: string; quantidade: number; created_at: string }> | null)?.forEach((m) => {
        const key = m.created_at?.slice(0, 10);
        if (!key || !seriesMap.has(key)) return;
        const item = seriesMap.get(key)!;
        if (m.tipo === "entrada") item.entradas += Number(m.quantidade ?? 0);
        else if (m.tipo === "saida") item.saidas += Number(m.quantidade ?? 0);
      });
      setSerieMovimentos(Array.from(seriesMap.values()));

      setLoading(false);
    }
    load();
  }, []);

  const maxSerie = Math.max(1, ...serieMovimentos.map((s) => Math.max(s.entradas, s.saidas)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventário</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Controle de estoque e movimentações</p>
        </div>
        <Link href="/inventario/entradas/nova" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg shadow-sm transition">
          + Entrada de Estoque
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Carregando...</div>
      ) : (
        <>
          {loadError ? (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              Erro ao carregar inventário: {loadError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { label: "Produtos Ativos", value: resumo.total_produtos, href: "/inventario/produtos", cor: "border-slate-200 bg-white" },
              { label: "Depósitos", value: resumo.total_depositos, href: "/inventario/depositos", cor: "border-slate-200 bg-white" },
              { label: "Entradas Pendentes", value: resumo.entradas_pendentes, href: "/inventario/entradas", cor: "border-amber-200 bg-gradient-to-br from-amber-50 to-white" },
              { label: "Movimentos Hoje", value: resumo.movimentos_hoje, href: "/inventario/movimentos", cor: "border-sky-200 bg-gradient-to-br from-sky-50 to-white" },
              { label: "Compras no mês", value: valorEntradasMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), href: "/inventario/entradas", cor: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white" },
              { label: "Abaixo do mínimo", value: itensAbaixoMinimo, href: "/inventario/produtos", cor: "border-rose-200 bg-gradient-to-br from-rose-50 to-white" },
            ].map((card) => (
              <Link key={card.href} href={card.href} className={`rounded-xl border ${card.cor} p-5 shadow-sm hover:bg-slate-50 transition`}>
                <div className="text-2xl font-bold text-slate-900">{card.value}</div>
                <div className="text-sm text-slate-600 mt-1">{card.label}</div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Movimentação (últimos 7 dias)</div>
              <div className="space-y-3">
                {serieMovimentos.map((s, idx) => (
                  <div key={`${s.dia}-${idx}`}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{s.dia}</span>
                      <span>Entrada {s.entradas} • Saída {s.saidas}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(s.entradas / maxSerie) * 100}%` }} />
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1">
                      <div className="h-full bg-rose-500" style={{ width: `${(s.saidas / maxSerie) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900 mb-3">Saúde do estoque</div>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="flex justify-between text-slate-600 mb-1">
                    <span>Itens com estoque abaixo do mínimo</span>
                    <span className="font-semibold text-rose-600">{itensAbaixoMinimo}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-rose-500" style={{ width: `${Math.min(100, (itensAbaixoMinimo / Math.max(1, resumo.total_produtos)) * 100)}%` }} />
                  </div>
                </div>

                <div className="text-xs text-slate-500 leading-relaxed">
                  Acompanhe diariamente entradas e saídas para evitar rupturas e manter nível saudável de reposição.
                </div>

                <div className="flex gap-2 pt-1">
                  <Link href="/inventario/produtos" className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50">
                    Ver produtos
                  </Link>
                  <Link href="/inventario/movimentos" className="text-xs px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    Ver movimentos
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {tanquesCombustivel.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-900">Marcador de combustível</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                {tanquesCombustivel.map((t) => {
                  const max = Math.max(1, Number(t.estoque_maximo ?? 0));
                  const pct = Math.min(100, Math.max(0, (t.saldo_total / max) * 100));
                  const minPct = t.estoque_minimo && t.estoque_minimo > 0 ? Math.min(100, Math.max(0, (t.estoque_minimo / max) * 100)) : 0;
                  const emReserva = t.estoque_minimo !== null && t.saldo_total <= t.estoque_minimo;
                  const needleDeg = -90 + (pct * 1.8);

                  return (
                    <Link key={t.id} href={`/inventario/produtos/${t.id}`} className="rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition">
                      <div className="text-sm font-semibold text-slate-900">{t.nome}</div>
                      <div className="text-xs text-slate-500 mb-3">
                        {t.saldo_total.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")} {t.unidade}
                      </div>

                      <div className="relative w-44 h-24 mx-auto">
                        <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-full border-[10px] border-slate-200 border-b-0" />
                        <div
                          className="absolute inset-x-0 bottom-0 h-24 rounded-t-full border-[10px] border-b-0"
                          style={{
                            borderColor: emReserva ? "#f43f5e" : "#10b981",
                            clipPath: `polygon(0 100%, 0 0, ${pct}% 0, ${pct}% 100%)`,
                          }}
                        />

                        <div className="absolute left-1/2 bottom-0 w-0.5 h-16 bg-slate-800 origin-bottom" style={{ transform: `translateX(-50%) rotate(${needleDeg}deg)` }} />
                        <div className="absolute left-1/2 bottom-0 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-slate-800" />

                        <div className="absolute left-0 bottom-0 text-[10px] text-slate-500">0%</div>
                        <div className="absolute right-0 bottom-0 text-[10px] text-slate-500">100%</div>
                        {t.estoque_minimo !== null && (
                          <div className="absolute text-[10px] text-amber-600 font-medium" style={{ left: `${minPct}%`, bottom: "-6px", transform: "translateX(-50%)" }}>
                            Reserva
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className={emReserva ? "text-rose-600 font-semibold" : "text-emerald-600 font-semibold"}>
                          {emReserva ? "Na reserva" : "Nível normal"}
                        </span>
                        <span className="text-slate-500">{pct.toFixed(1)}%</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {destaques.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-900">Produtos em Destaque</span>
              </div>
              <div className="divide-y divide-slate-100">
                {destaques.map((d) => {
                  const abaixo = d.estoque_minimo !== null && d.saldo_total < d.estoque_minimo;
                  const pct = d.estoque_minimo && d.estoque_minimo > 0
                    ? Math.min(100, Math.round((d.saldo_total / d.estoque_minimo) * 100))
                    : null;
                  return (
                    <div key={d.id} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <Link href={`/inventario/produtos/${d.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                          {d.nome}
                        </Link>
                        <span className={`text-sm font-semibold ${abaixo ? "text-rose-600" : "text-slate-800"}`}>
                          {d.saldo_total} {d.unidade}
                        </span>
                      </div>
                      {pct !== null && (
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${abaixo ? "bg-rose-500" : pct < 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {abaixo && (
                        <p className="text-xs text-rose-600 mt-1">Abaixo do estoque mínimo ({d.estoque_minimo} {d.unidade})</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Produtos", href: "/inventario/produtos", desc: "Cadastrar e gerenciar" },
              { label: "Fornecedores", href: "/inventario/fornecedores", desc: "Cadastro e vínculo com compras" },
              { label: "Depósitos", href: "/inventario/depositos", desc: "Locais de armazenagem" },
              { label: "Entradas", href: "/inventario/entradas", desc: "Recebimentos e compras" },
              { label: "Movimentos", href: "/inventario/movimentos", desc: "Histórico (kardex)" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50 transition">
                <div className="text-sm font-semibold text-slate-900">{a.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{a.desc}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
