"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Pedido = {
  id: string;
  codigo_acompanhamento: string;
  status: string;
  comprador_nome: string;
  quantidade_bilhetes: number;
  valor_total: number;
  expires_at: string | null;
  created_at: string;
};

type Pagamento = {
  id: string;
  pedido_id: string;
  status: string;
  gateway: string;
  metodo: string;
  created_at: string;
};

export default function ViagemPedidosPage() {
  const params = useParams<{ id: string }>();
  const viagemId = params?.id;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tituloViagem, setTituloViagem] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);

  async function carregar() {
    if (!viagemId) return;
    setLoading(true);
    setErro("");

    const [{ data: viagem, error: errViagem }, { data: ped, error: errPedidos }, { data: pay, error: errPay }] = await Promise.all([
      supabase.from("viagens").select("titulo").eq("id", viagemId).maybeSingle(),
      supabase
        .from("pedidos_viagem")
        .select("id,codigo_acompanhamento,status,comprador_nome,quantidade_bilhetes,valor_total,expires_at,created_at")
        .eq("viagem_id", viagemId)
        .order("created_at", { ascending: false }),
      supabase
        .from("pagamentos_viagem")
        .select("id,pedido_id,status,gateway,metodo,created_at")
        .eq("viagem_id", viagemId)
        .order("created_at", { ascending: false }),
    ]);

    if (errViagem || errPedidos || errPay) {
      setErro(errViagem?.message ?? errPedidos?.message ?? errPay?.message ?? "Erro ao carregar");
      setLoading(false);
      return;
    }

    setTituloViagem((viagem?.titulo as string) ?? "Viagem");
    setPedidos((ped ?? []) as Pedido[]);
    setPagamentos((pay ?? []) as Pagamento[]);
    setLoading(false);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void carregar();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viagemId]);

  const pagamentoPorPedido = useMemo(() => {
    const map = new Map<string, Pagamento>();
    pagamentos.forEach((p) => {
      if (!map.has(p.pedido_id)) map.set(p.pedido_id, p);
    });
    return map;
  }, [pagamentos]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pedidos da Viagem</h1>
          <p className="text-sm text-slate-600 mt-0.5">{tituloViagem}</p>
        </div>
        <Link href="/viagens" className="border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 text-sm">
          Voltar
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {erro ? <div className="text-sm text-red-700">{erro}</div> : null}
        {loading ? <div className="text-slate-600">Carregando pedidos...</div> : null}

        {!loading && pedidos.length === 0 ? <div className="text-slate-600">Nenhum pedido para esta viagem.</div> : null}

        {!loading && pedidos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Comprador</th>
                  <th className="py-2 pr-4">Pedido</th>
                  <th className="py-2 pr-4">Pagamento</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-0 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const pay = pagamentoPorPedido.get(p.id);
                  return (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium">{p.codigo_acompanhamento}</td>
                      <td className="py-2 pr-4">{p.comprador_nome}</td>
                      <td className="py-2 pr-4">{p.status}</td>
                      <td className="py-2 pr-4">{pay ? `${pay.status} (${pay.gateway}/${pay.metodo})` : "—"}</td>
                      <td className="py-2 pr-4">{Number(p.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                      <td className="py-2 pr-0 text-right">
                        <Link href={`/viagens/${viagemId}/pedidos/${p.id}`} className="text-blue-700 hover:underline">
                          Ver detalhes
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
