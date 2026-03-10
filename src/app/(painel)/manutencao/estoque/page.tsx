"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Kpis = {
  reservas_abertas: number;
  itens_aplicados: number;
  manutencoes_aguardando_pecas: number;
  movimentos_manutencao_30d: number;
};

type MovimentoRecente = {
  id: string;
  created_at: string;
  tipo: string;
  quantidade: number;
  valor_total: number | null;
  manutencao_id: string | null;
  produtos: { nome: string; unidade: string } | null;
};

export default function ManutencaoEstoquePage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [kpis, setKpis] = useState<Kpis>({
    reservas_abertas: 0,
    itens_aplicados: 0,
    manutencoes_aguardando_pecas: 0,
    movimentos_manutencao_30d: 0,
  });
  const [recentes, setRecentes] = useState<MovimentoRecente[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");

      const inicio30d = new Date();
      inicio30d.setDate(inicio30d.getDate() - 30);

      const [
        { count: reservasAbertas, error: eReservas },
        { count: itensAplicados, error: eAplicados },
        { count: manutencoesAguardando, error: eAguardando },
        { count: movs30d, error: eMovs },
        { data: movimentosRecentes, error: eRecentes },
      ] = await Promise.all([
        supabase.from("manutencao_itens").select("id", { count: "exact", head: true }).in("status", ["solicitado", "reservado"]),
        supabase.from("manutencao_itens").select("id", { count: "exact", head: true }).eq("status", "aplicado"),
        supabase.from("manutencoes").select("id", { count: "exact", head: true }).in("status", ["aguardando_pecas", "compra_solicitada", "compra_em_andamento", "pecas_recebidas"]),
        supabase.from("movimentos_estoque").select("id", { count: "exact", head: true }).or("origem.eq.manutencao,manutencao_id.not.is.null").gte("created_at", inicio30d.toISOString()),
        supabase
          .from("movimentos_estoque")
          .select("id, created_at, tipo, quantidade, valor_total, manutencao_id, produtos(nome, unidade)")
          .or("origem.eq.manutencao,manutencao_id.not.is.null")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      const primeiroErro = eReservas || eAplicados || eAguardando || eMovs || eRecentes;
      if (primeiroErro) setErro(primeiroErro.message);

      setKpis({
        reservas_abertas: reservasAbertas ?? 0,
        itens_aplicados: itensAplicados ?? 0,
        manutencoes_aguardando_pecas: manutencoesAguardando ?? 0,
        movimentos_manutencao_30d: movs30d ?? 0,
      });

      setRecentes((movimentosRecentes as MovimentoRecente[] | null) ?? []);
      setLoading(false);
    }

    void load();
  }, []);

  const valorMovimentosRecentes = useMemo(
    () => recentes.reduce((acc, m) => acc + Number(m.valor_total ?? 0), 0),
    [recentes]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Estoque da manutenção</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Reservas, consumo de peças e integração com inventário.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/manutencao/estoque/reservas" className="px-4 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50">
            Ver reservas
          </Link>
          <Link href="/manutencao/estoque/consumo" className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-500">
            Ver consumo
          </Link>
        </div>
      </div>

      {erro ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Atenção: alguns dados podem estar indisponíveis até aplicar as migrations mais recentes. Detalhe: {erro}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Reservas abertas" value={kpis.reservas_abertas} href="/manutencao/estoque/reservas" />
            <KpiCard label="Itens aplicados" value={kpis.itens_aplicados} href="/manutencao/estoque/consumo" />
            <KpiCard label="Aguardando peças" value={kpis.manutencoes_aguardando_pecas} href="/manutencao" />
            <KpiCard label="Movimentos 30 dias" value={kpis.movimentos_manutencao_30d} href="/inventario/movimentos" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">Conexão Manutenção + Inventário</div>
              <ul className="mt-3 text-sm text-slate-600 space-y-1 list-disc pl-5">
                <li>Reserva de peça sem baixa imediata</li>
                <li>Baixa real apenas no uso (consumo)</li>
                <li>Movimentação vinculada à manutenção e veículo</li>
                <li>Rastreabilidade em histórico e kardex</li>
              </ul>
              <div className="mt-4 flex gap-2">
                <Link href="/inventario" className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50">
                  Abrir inventário
                </Link>
                <Link href="/inventario/movimentos" className="text-xs px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  Kardex geral
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">Resumo financeiro recente</div>
              <div className="mt-3 text-2xl font-bold text-slate-900">
                {valorMovimentosRecentes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Soma dos movimentos de manutenção exibidos abaixo.</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900 mb-3">Movimentos recentes de manutenção</div>
            {recentes.length === 0 ? (
              <div className="text-sm text-slate-500">Sem movimentos recentes.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Data</th>
                      <th className="py-2 pr-4">Produto</th>
                      <th className="py-2 pr-4">Tipo</th>
                      <th className="py-2 pr-4">Qtd.</th>
                      <th className="py-2 pr-4">Valor</th>
                      <th className="py-2">Manutenção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentes.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 text-slate-500">{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                        <td className="py-2 pr-4">{m.produtos?.nome ?? "—"}</td>
                        <td className="py-2 pr-4">{m.tipo}</td>
                        <td className="py-2 pr-4">{m.quantidade} {m.produtos?.unidade ?? ""}</td>
                        <td className="py-2 pr-4">{Number(m.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                        <td className="py-2 text-slate-500">{m.manutencao_id ? m.manutencao_id.slice(0, 8) : "—"}</td>
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

function KpiCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50 transition">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-sm text-slate-600 mt-1">{label}</div>
    </Link>
  );
}
