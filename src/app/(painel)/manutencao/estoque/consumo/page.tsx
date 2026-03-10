"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

type Consumo = {
  id: string;
  created_at: string;
  quantidade: number;
  valor_total: number | null;
  manutencao_id: string | null;
  veiculo_id: string | null;
  produtos: { nome: string; unidade: string } | null;
  depositos: { nome: string } | null;
};

export default function ConsumoManutencaoPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [consumos, setConsumos] = useState<Consumo[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("movimentos_estoque")
        .select("id, created_at, quantidade, valor_total, manutencao_id, veiculo_id, produtos(nome, unidade), depositos(nome)")
        .eq("tipo", "saida")
        .or("origem.eq.manutencao,manutencao_id.not.is.null")
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) setErro(error.message);
      setConsumos((data as Consumo[] | null) ?? []);
      setLoading(false);
    }

    void load();
  }, []);

  const custoTotal = useMemo(
    () => consumos.reduce((acc, c) => acc + Number(c.valor_total ?? 0), 0),
    [consumos]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Consumo / baixas</h1>
          <p className="text-sm text-slate-500">Baixas definitivas de estoque vinculadas à manutenção.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/manutencao/estoque" className="text-sm px-4 py-2 rounded-md border border-slate-300 hover:bg-slate-50">
            Voltar
          </Link>
          <Link href="/inventario/movimentos" className="text-sm px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500">
            Kardex completo
          </Link>
        </div>
      </div>

      {erro ? <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="text-sm text-slate-600">
          Custo total exibido: <strong>{custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {loading ? (
          <div className="text-sm text-slate-500">Carregando...</div>
        ) : consumos.length === 0 ? (
          <div className="text-sm text-slate-500">Nenhuma baixa de manutenção encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Depósito</th>
                  <th className="py-2 pr-4">Quantidade</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Manutenção</th>
                  <th className="py-2">Veículo</th>
                </tr>
              </thead>
              <tbody>
                {consumos.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-slate-500">{new Date(c.created_at).toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-4">{c.produtos?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{c.depositos?.nome ?? "—"}</td>
                    <td className="py-2 pr-4">{c.quantidade} {c.produtos?.unidade ?? ""}</td>
                    <td className="py-2 pr-4">{Number(c.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="py-2 pr-4 text-slate-500">{c.manutencao_id ? c.manutencao_id.slice(0, 8) : "—"}</td>
                    <td className="py-2 text-slate-500">{c.veiculo_id ? c.veiculo_id.slice(0, 8) : "—"}</td>
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
