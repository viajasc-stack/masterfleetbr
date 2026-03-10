"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";

type Req = {
  id: string;
  item_descricao: string;
  quantidade: number;
  valor_total_previsto: number | null;
  status: string;
  manutencoes: { numero: number | null; veiculos: { placa: string | null } | null } | null;
};

export default function ManutencaoComprasPage() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("manutencao_requisicoes_compra")
      .select("id,item_descricao,quantidade,valor_total_previsto,status,manutencoes(numero,veiculos(placa))")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as Req[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Compras da manutenção" description="Requisições geradas por falta de peças nas manutenções." />

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-slate-600">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="text-slate-600">Nenhuma requisição de compra.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Manutenção</th>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4">Qtd.</th>
                  <th className="py-2 pr-4">Valor previsto</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.manutencoes?.numero ? `MNT-${String(r.manutencoes.numero).padStart(5, "0")}` : "—"} {r.manutencoes?.veiculos?.placa ? `• ${r.manutencoes.veiculos.placa}` : ""}</td>
                    <td className="py-2 pr-4">{r.item_descricao}</td>
                    <td className="py-2 pr-4">{r.quantidade}</td>
                    <td className="py-2 pr-4">{Number(r.valor_total_previsto ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="py-2">{r.status}</td>
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
