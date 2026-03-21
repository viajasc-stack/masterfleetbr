"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { errorMessage, numberBR } from "@/lib/estoque";
import { supabase } from "@/lib/supabase/client";

type Item = {
  id: string;
  nome: string;
  codigo_interno: string | null;
  unidade_medida: string;
  estoque_minimo: number | null;
  estoque_ideal: number | null;
  fornecedor_principal_id: string | null;
  ativo: boolean;
  fornecedores?: { nome?: string } | null;
};

export default function AlertasReposicaoPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [saldos, setSaldos] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErro("");
      try {
        const [{ data: itensData, error: itensErr }, { data: estoqueData, error: estoqueErr }] = await Promise.all([
          supabase
            .from("itens_estoque")
            .select("id, nome, codigo_interno, unidade_medida, estoque_minimo, estoque_ideal, fornecedor_principal_id, ativo, fornecedores(nome)")
            .eq("ativo", true)
            .order("nome"),
          supabase.from("estoques").select("item_id, quantidade"),
        ]);

        if (itensErr) throw itensErr;
        if (estoqueErr) throw estoqueErr;

        const mapa: Record<string, number> = {};
        ((estoqueData ?? []) as Array<{ item_id: string; quantidade: number | null }>).forEach((s) => {
          mapa[s.item_id] = (mapa[s.item_id] ?? 0) + Number(s.quantidade ?? 0);
        });

        setItens((itensData as Item[] | null) ?? []);
        setSaldos(mapa);
      } catch (e) {
        setErro(errorMessage(e, "Falha ao carregar alertas."));
      } finally {
        setLoading(false);
      }
    }

    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens
      .map((item) => {
        const saldo = Number(saldos[item.id] ?? 0);
        const minimo = Number(item.estoque_minimo ?? 0);
        const ideal = Number(item.estoque_ideal ?? 0);
        const precisaReposicao = minimo > 0 ? saldo < minimo : saldo <= 0;
        const zerado = saldo <= 0;
        const sugestao = Math.max(0, (ideal > 0 ? ideal : minimo > 0 ? minimo : 0) - saldo);
        return { item, saldo, minimo, ideal, precisaReposicao, zerado, sugestao };
      })
      .filter((l) => l.precisaReposicao)
      .filter((l) => {
        if (!q) return true;
        return [l.item.nome, l.item.codigo_interno ?? "", l.item.fornecedores?.nome ?? ""].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.zerado !== b.zerado) return a.zerado ? -1 : 1;
        return a.saldo - b.saldo;
      });
  }, [busca, itens, saldos]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque · Alertas e Reposição"
        description="Itens abaixo do mínimo ou zerados, com sugestão de reposição para ação rápida de compras."
        actions={
          <>
            <Link href="/inventario/compras" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
              Ir para compras
            </Link>
            <Link href="/inventario/itens" className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500">
              Gerenciar itens
            </Link>
          </>
        }
      />

      {erro ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</div> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Buscar por item, código ou fornecedor"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 overflow-x-auto">
        {loading ? <div className="text-sm text-slate-500">Carregando alertas...</div> : null}
        {!loading && linhas.length === 0 ? <div className="text-sm text-slate-500">Nenhum item em alerta de reposição.</div> : null}
        {!loading && linhas.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4">Item</th>
                <th className="py-2 pr-4">Fornecedor</th>
                <th className="py-2 pr-4">Saldo atual</th>
                <th className="py-2 pr-4">Mínimo</th>
                <th className="py-2 pr-4">Ideal</th>
                <th className="py-2 pr-4">Reposição sugerida</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.item.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">
                    {l.item.nome}
                    {l.item.codigo_interno ? <span className="ml-2 text-xs text-slate-500">({l.item.codigo_interno})</span> : null}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{l.item.fornecedores?.nome ?? "—"}</td>
                  <td className="py-2 pr-4 font-semibold text-rose-700">{numberBR(l.saldo, 3)} {l.item.unidade_medida}</td>
                  <td className="py-2 pr-4">{numberBR(l.minimo, 3)}</td>
                  <td className="py-2 pr-4">{l.ideal > 0 ? numberBR(l.ideal, 3) : "—"}</td>
                  <td className="py-2 pr-4">{numberBR(l.sugestao, 3)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-flex rounded px-2 py-1 text-xs border ${l.zerado ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                      {l.zerado ? "Sem estoque" : "Abaixo do mínimo"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <Link href="/inventario/compras" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
                      Comprar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
