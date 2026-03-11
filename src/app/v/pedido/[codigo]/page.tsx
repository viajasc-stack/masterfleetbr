"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PedidoTrack = {
  pedido_id: string;
  codigo_acompanhamento: string;
  pedido_status: string;
  pedido_expires_at: string | null;
  valor_total: number;
  comprador_nome: string;
  viagem_id: string;
  viagem_titulo: string;
  viagem_data_ida: string;
  viagem_cidade_destino: string | null;
  pagamento_status: string | null;
  pagamento_gateway: string | null;
  pagamento_metodo: string | null;
  pagamento_pix_copia_cola: string | null;
  pagamento_pix_qr_code: string | null;
  pagamento_boleto_url: string | null;
  passageiros_total: number;
  passageiros_confirmados: number;
};

export default function ViagemPedidoTrackingPage() {
  const params = useParams<{ codigo: string }>();
  const codigo = params?.codigo;

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [pedido, setPedido] = useState<PedidoTrack | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!codigo) {
          setErro("Código inválido.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.rpc("public_get_pedido_viagem_by_codigo", {
          p_codigo: codigo,
        });

        if (error) {
          setErro("Não foi possível consultar o pedido.");
          setLoading(false);
          return;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          setErro("Pedido não encontrado.");
          setLoading(false);
          return;
        }

        setPedido(row as PedidoTrack);
        setLoading(false);
      })();
    }, 0);

    return () => clearTimeout(id);
  }, [codigo]);

  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-6">Carregando acompanhamento...</div>;
  }

  if (erro || !pedido) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-red-200 bg-white p-6 text-red-700">{erro || "Pedido não encontrado."}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Acompanhamento do Pedido</h1>
          <p className="text-sm text-slate-600">Código: <span className="font-semibold">{pedido.codigo_acompanhamento}</span></p>
          <p className="text-sm text-slate-600">Comprador: {pedido.comprador_nome}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 grid md:grid-cols-2 gap-4 text-sm">
          <Card label="Viagem" value={pedido.viagem_titulo} />
          <Card label="Destino" value={pedido.viagem_cidade_destino ?? "—"} />
          <Card label="Data da viagem" value={new Date(`${pedido.viagem_data_ida}T00:00:00`).toLocaleDateString("pt-BR")} />
          <Card label="Valor total" value={Number(pedido.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
          <Card label="Status do pedido" value={pedido.pedido_status} />
          <Card label="Status do pagamento" value={pedido.pagamento_status ?? "—"} />
          <Card label="Passageiros" value={`${pedido.passageiros_confirmados}/${pedido.passageiros_total} confirmados`} />
          <Card label="Gateway / método" value={`${pedido.pagamento_gateway ?? "—"} / ${pedido.pagamento_metodo ?? "—"}`} />
        </div>

        {pedido.pedido_expires_at ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Reserva válida até: {new Date(pedido.pedido_expires_at).toLocaleString("pt-BR")}
          </div>
        ) : null}

        {pedido.pagamento_pix_copia_cola ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">PIX</h2>
            <p className="text-xs break-all text-slate-700">{pedido.pagamento_pix_copia_cola}</p>
          </div>
        ) : null}

        {pedido.pagamento_boleto_url ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <a href={pedido.pagamento_boleto_url} target="_blank" rel="noreferrer" className="text-blue-700 underline text-sm">
              Abrir boleto
            </a>
          </div>
        ) : null}

        <div className="text-xs text-slate-500">
          <Link href="/" className="underline">MasterFleetBR</Link>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-slate-900">{value}</div>
    </div>
  );
}
